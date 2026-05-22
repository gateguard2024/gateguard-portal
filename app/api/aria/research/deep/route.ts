/**
 * POST /api/aria/research/deep
 *
 * ARIA Deep Intel — multi-source property intelligence pipeline.
 * Runs after the initial ARIA result returns a known property name/address.
 *
 * Intelligence sources (all free, run in parallel):
 *   A. Tavily web search  — 10 targeted queries across ISP, bulk, proptech, local ISPs, ownership
 *   B. SEC EDGAR EFTS     — REIT 10-K/10-Q filings disclose portfolio-wide bulk internet agreements
 *   C. State PUC search   — ISPs file for ROW/conduit access; PUC dockets reveal ISP infrastructure
 *   D. City permit search — Fiber/conduit permits confirm ISP physical presence in a building
 *   E. ISP MDU press      — ISP newsrooms announce MDU/bulk deal wins (Comcast Communities, etc.)
 *
 * Claude Haiku synthesizes all excerpts into structured output with citations.
 *
 * Cost: ~14 Tavily basic credits (~$0.112) + ~$0.001 Claude Haiku + $0 for EDGAR/PUC/permit (free APIs)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { resolveOrgScope } from '@/lib/org-scope'
import { getCurrentUser } from '@/lib/current-user'

const supabaseDeep = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ─── Tavily helper ────────────────────────────────────────────────────────

interface TavilyResult {
  title: string
  url: string
  content: string
  score: number
  source?: string  // track which search this came from
}

interface TavilyResponse {
  results: TavilyResult[]
  answer?: string
}

async function tavilySearch(query: string, maxResults = 5, source = 'web'): Promise<TavilyResult[]> {
  if (!process.env.TAVILY_API_KEY) return []
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        search_depth: 'basic',
        max_results: maxResults,
        include_answer: false,
        include_raw_content: false,
        include_images: false,
      }),
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return []
    const data: TavilyResponse = await res.json()
    return (data.results ?? []).map(r => ({ ...r, source }))
  } catch {
    return []
  }
}

// ─── SEC EDGAR full-text search ───────────────────────────────────────────
// Free. No auth required. REIT 10-K/10-Q filings often disclose material bulk
// service agreements. Searching property name + "MDU" / "bulk" surfaces these.
// Also search management company name — large mgmt cos appear in REIT filings
// even when the REIT doesn't own the property directly.

interface EdgarResult {
  title: string
  url: string
  content: string
  score: number
  source: string
}

async function searchEdgar(
  propertyName: string,
  managementCompany: string,
): Promise<EdgarResult[]> {
  const results: EdgarResult[] = []

  const queries = [
    // Property-level: REIT filing mentions the property name + bulk deal
    `"${propertyName}" "bulk internet" OR "MDU agreement" OR "exclusive internet" OR "bulk broadband"`,
    // Management company level: portfolio-wide bulk service contracts in REIT filings
    managementCompany
      ? `"${managementCompany}" "MDU" "internet" "exclusive" OR "bulk agreement" OR "preferred provider"`
      : null,
  ].filter(Boolean) as string[]

  for (const q of queries) {
    try {
      const url = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(q)}&forms=10-K%2C10-Q%2C8-K&dateRange=custom&startdt=2018-01-01`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'GateGuard-ARIA/1.0 (rfeldman@gateguard.co)' },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) continue
      const data = await res.json()
      const hits: any[] = data?.hits?.hits ?? []
      for (const hit of hits.slice(0, 4)) {
        const highlights: string[] = hit.highlight?.file_contents ?? []
        if (highlights.length === 0) continue
        const entity   = hit._source?.entity_name ?? 'Unknown entity'
        const form     = hit._source?.form_type   ?? 'SEC filing'
        const fileDate = hit._source?.file_date   ?? ''
        const accNum   = hit._source?.accession_no ?? ''
        const edgarUrl = accNum
          ? `https://www.sec.gov/Archives/edgar/data/${hit._source?.entity_id}/${accNum.replace(/-/g, '')}/`
          : `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(q)}&forms=10-K%2C10-Q`
        results.push({
          title:   `${entity} — ${form} (${fileDate})`,
          url:     edgarUrl,
          content: highlights
            .slice(0, 2)
            .map((h: string) => h.replace(/<\/?em>/g, '**'))
            .join(' ... '),
          score:   0.75, // EDGAR results are high-quality primary sources
          source:  'EDGAR',
        })
      }
    } catch {
      // Non-blocking
    }
  }

  return results
}

// ─── State PUC search via Tavily ──────────────────────────────────────────
// State Public Utility Commissions receive filings when ISPs apply for Right-of-Way
// or conduit access to buildings. FL, TX, GA, NC, TN have searchable online dockets.
// Tavily can surface these docket pages — they directly confirm ISP physical presence.

async function searchPUC(
  propertyName: string,
  address: string,
  state: string,
): Promise<TavilyResult[]> {
  if (!process.env.TAVILY_API_KEY) return []
  if (!state) return []

  // Map state abbreviations to PUC domain for targeted search
  const pucDomains: Record<string, string> = {
    FL: 'floridapsc.com',
    TX: 'puc.texas.gov',
    GA: 'psc.state.ga.us',
    NC: 'ncuc.net',
    TN: 'tn.gov/puc',
    CA: 'cpuc.ca.gov',
    NY: 'dps.ny.gov',
    VA: 'scc.virginia.gov',
    AZ: 'azcc.gov',
    CO: 'puc.colorado.gov',
  }

  const stateAbbr = state.trim().toUpperCase().slice(0, 2)
  const pucDomain = pucDomains[stateAbbr]

  const queries = [
    // General PUC search for ISP + property location
    `${address || propertyName} ${state} ISP internet "right of way" OR "conduit" OR "MDU" fiber telecom permit site:${pucDomain || 'gov'}`,
    // Broader state search if no domain match
    `"${address || propertyName}" ${state} public utility commission internet provider filing`,
  ]

  const pucResults = await Promise.all(
    queries.slice(0, pucDomain ? 1 : 1).map(q => tavilySearch(q, 3, 'PUC'))
  )
  return pucResults.flat()
}

// ─── City permit search via Tavily + Socrata ──────────────────────────────
// When an ISP pulls fiber/conduit into a building they file a permit with the city.
// Key cities (Atlanta, Nashville, Dallas, Austin, Charlotte) have open permit portals.
// Permits confirm physical ISP infrastructure — stronger signal than marketing claims.

async function searchCityPermits(
  address: string,
  city: string,
  state: string,
): Promise<TavilyResult[]> {
  if (!process.env.TAVILY_API_KEY || !city) return []

  const cityLower = city.toLowerCase()

  // Cities with known open permit data portals (Socrata-based)
  const openDataCities: Record<string, string> = {
    atlanta:     'data.atlantaga.gov',
    nashville:   'data.nashville.gov',
    dallas:      'dallasopendata.com',
    austin:      'data.austintexas.gov',
    charlotte:   'data.charlottenc.gov',
    phoenix:     'data.phoenix.gov',
    denver:      'denvergov.org/opendata',
    raleigh:     'data-ral.opendata.arcgis.com',
    miami:       'gis.miamifl.gov',
    tampa:       'data.tampagov.net',
  }

  const matchedCity = Object.keys(openDataCities).find(c => cityLower.includes(c))
  const portalDomain = matchedCity ? openDataCities[matchedCity] : null

  const queries = [
    // Site-specific: target the city's open data portal for telecom permits
    portalDomain
      ? `${address} telecommunications OR fiber OR conduit permit site:${portalDomain}`
      : `${address} ${city} ${state} ISP fiber conduit permit "telecommunications" filetype:html`,
    // General permit search across city permit portals
    `"${address}" OR "${city} ${state}" ISP internet fiber permit "Comcast" OR "Spectrum" OR "AT&T" OR "telecom" construction permit`,
  ]

  const permitResults = await Promise.all(
    queries.map(q => tavilySearch(q, 3, 'CityPermit'))
  )
  return permitResults.flat()
}

// ─── ISP MDU press release search ─────────────────────────────────────────
// ISPs announce bulk/MDU deals on their partner portals and newsrooms.
// Comcast Communities, Spectrum Communities, AT&T Smart Communities,
// and regional ISPs all issue press releases or update partner portals.
// These are indexed by search engines and surfaced by Tavily.

async function searchISPPressReleases(
  propertyName: string,
  managementCompany: string,
  location: string,
): Promise<TavilyResult[]> {
  if (!process.env.TAVILY_API_KEY) return []

  const queries = [
    // ISP MDU program announcements targeting this property or management co
    `"${propertyName}" OR "${managementCompany}" "Comcast Communities" OR "Xfinity Communities" OR "Spectrum Communities" OR "AT&T Smart Communities" OR "Lumen MDU" OR "Frontier MDU" internet deal announcement`,
    // Local/regional ISP deal announcements — often overlooked but highly accurate
    `"${propertyName}" OR "${managementCompany}" ${location} internet provider "partnership" OR "agreement" OR "deal" OR "service agreement" multifamily apartment`,
    // Property management company bulk deal announcements
    managementCompany
      ? `"${managementCompany}" internet OR broadband "portfolio" OR "exclusive" OR "bulk" agreement announcement`
      : `"${propertyName}" ${location} internet bulk "agreement" OR "partnership" announcement`,
  ]

  const pressResults = await Promise.all(
    queries.map(q => tavilySearch(q, 3, 'ISP-Press'))
  )
  return pressResults.flat()
}

// ─── Deep intel synthesis tool ────────────────────────────────────────────

const deepIntelTool: Anthropic.Tool = {
  name: 'aria_deep_intel_result',
  description: 'Return the structured deep connectivity, proptech, and ownership intelligence for this property.',
  input_schema: {
    type: 'object' as const,
    required: ['isp_providers', 'video_providers', 'bulk_agreements', 'key_finding', 'confidence', 'proptech'],
    properties: {
      isp_providers: {
        type: 'array',
        items: { type: 'string' },
        description: 'ISPs confirmed or strongly indicated to serve this specific property — include local/regional ISPs found in sources',
      },
      video_providers: {
        type: 'array',
        items: { type: 'string' },
        description: 'Video/TV providers confirmed or strongly indicated at this property',
      },
      bulk_agreements: {
        type: 'array',
        description: 'Bulk/exclusive/preferred ISP or video agreements. Return empty array [] if no property-specific evidence found — never infer.',
        items: {
          type: 'object',
          required: ['provider', 'service_type', 'agreement_type', 'expiry_estimate', 'confidence', 'evidence', 'evidence_source'],
          properties: {
            provider:        { type: 'string', description: 'Exact ISP/provider name from source — use verbatim, including local/regional ISPs' },
            service_type:    { type: 'string', enum: ['internet', 'video', 'bundled'] },
            agreement_type:  { type: 'string', enum: ['exclusive', 'bulk', 'preferred', 'unknown'] },
            expiry_estimate: { type: 'string' },
            confidence:      { type: 'string', enum: ['high', 'medium', 'low'], description: 'high=explicit text evidence, medium=implied, low=inferred from patterns only' },
            evidence:        { type: 'string', description: 'Exact quote from source text (under 100 chars) — required for high/medium confidence' },
            evidence_source: { type: 'string', enum: ['EDGAR', 'PUC', 'CityPermit', 'ISP-Press', 'web', 'resident-review', 'listing-site'], description: 'Which intelligence source this came from' },
          },
        },
      },
      key_finding: {
        type: 'string',
        description: '1-2 sentence sales insight: WHO to call (asset manager/owner if found) and WHY NOW (bulk deal expiry, recent acquisition, aging tech, SEC filing signal)',
      },
      confidence: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: 'Overall confidence level. Upgrade to high only when EDGAR or permit sources confirm findings.',
      },
      atlas_opportunity: {
        type: 'boolean',
        description: 'True if DirecTV/AT&T video agreement detected or strongly implied — ATLAS bundle pitch applicable',
      },
      edgar_signal: {
        type: 'boolean',
        description: 'True if any EDGAR (SEC filing) source confirmed a relevant agreement or ownership detail',
      },
      permit_signal: {
        type: 'boolean',
        description: 'True if a city permit or PUC filing confirmed ISP physical infrastructure at this address',
      },
      ownership: {
        type: 'object',
        description: 'Who actually owns and controls capex for this property',
        properties: {
          owner_entity:     { type: 'string', description: 'Legal owner / investment firm name' },
          owner_type:       { type: 'string', enum: ['private_equity', 'reit', 'family_office', 'individual', 'management_company_owned', 'unknown'] },
          portfolio_size:   { type: 'string', description: 'Approx number of units this owner controls if found in sources' },
          acquisition_year: { type: 'string', description: 'Year owner acquired this property if mentioned, else "unknown"' },
          capex_signal:     { type: 'string', description: 'Evidence of recent/planned capital investment (renovation, refinancing, acquisition, SEC 8-K)' },
          sec_filing_ref:   { type: 'string', description: 'EDGAR filing reference if ownership confirmed from SEC source (entity name + form + date)' },
          asset_manager: {
            type: 'object',
            description: 'The asset manager or portfolio manager at the ownership entity who controls capex approval',
            properties: {
              name:             { type: 'string' },
              title:            { type: 'string' },
              company:          { type: 'string' },
              linkedin_slug:    { type: 'string' },
              email:            { type: 'string' },
              email_confidence: { type: 'number' },
            },
          },
        },
      },
      proptech: {
        type: 'object',
        properties: {
          gate_operators:      { type: 'array', items: { type: 'string' } },
          access_control:      { type: 'array', items: { type: 'string' } },
          intercoms:           { type: 'array', items: { type: 'string' } },
          cameras:             { type: 'array', items: { type: 'string' } },
          smart_locks:         { type: 'array', items: { type: 'string' } },
          resident_apps:       { type: 'array', items: { type: 'string' } },
          tech_generation:     { type: 'string', enum: ['legacy','modern','hybrid'] },
          sara_signals:        { type: 'boolean' },
          replacement_window:  { type: 'string' },
          displacement_targets:{ type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
}

// ─── Route handler ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!process.env.TAVILY_API_KEY) {
      return NextResponse.json({ error: 'TAVILY_API_KEY not configured' }, { status: 503 })
    }

    const { property_name, address, management_company, city, state } = await req.json()
    if (!property_name) return NextResponse.json({ error: 'property_name required' }, { status: 400 })

    const location = [city, state].filter(Boolean).join(', ') || address || ''
    const mgmt = management_company || ''

    // ── Prefetch MDU provider DB + cached detections (parallel, non-blocking) ──
    let mduProviderSlugsDeep: Array<{ name: string; slug: string; property_page_pattern: string | null }> = []
    let cachedDetectionsBlockDeep = ''

    await Promise.allSettled([
      (async () => {
        try {
          const { data: providers } = await supabaseDeep
            .from('mdu_providers')
            .select('name, slug, property_page_pattern, operator_page_pattern')
            .eq('active', true)
            .or('property_page_pattern.not.is.null,operator_page_pattern.not.is.null')
          if (providers) mduProviderSlugsDeep = providers as any[]
        } catch { /* non-blocking */ }
      })(),
      (async () => {
        try {
          const { data: detections } = await supabaseDeep
            .from('mdu_provider_detections')
            .select(`
              confidence, source_type, source_snippet, contract_end_year, verified_by,
              mdu_providers ( name, provider_type )
            `)
            .ilike('property_name', `%${property_name}%`)
            .in('confidence', ['confirmed', 'high', 'medium'])
            .limit(10)

          if (detections && detections.length > 0) {
            const lines = detections.map((d: any) => {
              const prov = d.mdu_providers as { name: string; provider_type: string } | null
              const expiry = d.contract_end_year ? ` (contract est. ends ~${d.contract_end_year})` : ''
              const snippet = d.source_snippet ? ` — "${d.source_snippet}"` : ''
              return `• ${prov?.name ?? 'Unknown'} (${prov?.provider_type ?? 'isp'}): ${d.confidence} [${d.source_type}]${expiry}${snippet}`
            })
            cachedDetectionsBlockDeep = `\n\nGATEGUARD CACHED PROVIDER DETECTIONS for "${property_name}":\n${lines.join('\n')}\n`
          }
        } catch { /* non-blocking */ }
      })(),
    ])

    // ── All intelligence sources in parallel ────────────────────────────
    // Group A: Tavily web searches (10)
    // Group B: EDGAR SEC filings (direct API, free)
    // Group C: State PUC dockets (via Tavily, targeted)
    // Group D: City permit portals (via Tavily + Socrata targeting)
    // Group E: ISP MDU press releases (via Tavily, targeted)

    const [
      // Group A — Tavily web searches
      ispResults,
      bulkResults,
      mgmtResults,
      redditResults,
      gateResults,
      proptechResults,
      residentTechResults,
      mgmtProptechResults,
      localIspResults,
      ownershipResults,
      // Group A+ — Provider slug pages (MDU ISP property portals)
      providerSlugResultsDeep,
      // Group B — EDGAR SEC
      edgarResults,
      // Group C — PUC dockets
      pucResults,
      // Group D — City permits
      permitResults,
      // Group E — ISP press releases
      ispPressResults,
    ] = await Promise.all([
      // 1. ISP service at this property — general availability + resident experience
      tavilySearch(`"${property_name}" ${location} internet provider ISP service`, 5, 'web'),

      // 2. Bulk/included internet signals — listing sites, local ISPs
      tavilySearch(`"${property_name}" "internet included" OR "bulk internet" OR "fiber included" OR "Comcast included" OR "Spectrum included" OR "AT&T included" OR "preferred provider" OR "gigastream" OR "sonic" OR "hotwire" OR "vyve" OR "local internet"`, 5, 'web'),

      // 3. Management company MDU patterns — portfolio-wide deals
      mgmt
        ? tavilySearch(`"${mgmt}" MDU internet bulk agreement exclusive OR "local ISP" OR "regional fiber"`, 5, 'web')
        : Promise.resolve([] as TavilyResult[]),

      // 4. Resident forum posts — Reddit, ApartmentRatings, Google Reviews
      tavilySearch(`"${property_name}" ${location} internet ISP "locked in" OR "only option" OR "bulk deal" OR "included with rent" OR "can only use" OR "building internet"`, 5, 'web'),

      // 5. Gate/access/intercom tech at this property
      tavilySearch(`"${property_name}" ${location} gate intercom "access control" cameras security technology vendor`, 5, 'web'),

      // 6. Specific proptech vendor mentions
      tavilySearch(`"${property_name}" OR "${mgmt}" ButterflyMX OR Brivo OR LiftMaster OR DoorKing OR SmartRent OR Latch OR Openpath OR Verkada OR "Eagle Eye"`, 5, 'web'),

      // 7. Resident tech complaints — what's installed and broken
      tavilySearch(`"${property_name}" "gate broken" OR "gate stuck" OR "intercom" OR "key fob" OR "access" OR "package" OR "smart lock" OR "cameras not working"`, 5, 'web'),

      // 8. Management company proptech standards
      mgmt
        ? tavilySearch(`"${mgmt}" multifamily proptech "access control" OR "gate operator" OR "smart home" preferred vendor standard`, 4, 'web')
        : Promise.resolve([] as TavilyResult[]),

      // 9. LOCAL/REGIONAL ISP detection on apartment listing sites — high accuracy
      tavilySearch(`"${property_name}" ${location} "bulk internet" OR "internet included" OR "fiber included" site:apartmentlist.com OR site:apartments.com OR site:zillow.com OR site:rent.com OR site:apartmentratings.com`, 5, 'listing-site'),

      // 10. Ownership + asset management
      tavilySearch(`"${property_name}" ${location} "asset manager" OR "portfolio manager" OR "ownership" OR "acquired" OR "owner" OR "investment" multifamily`, 4, 'web'),

      // Group A+: Provider slug pages — check known MDU ISP property/operator portals
      // e.g. gigstreem.com/amli-marina-del-rey or pavlovmedia.com/property-name
      // Run the top 6 providers with URL patterns in parallel
      (async () => {
        if (!process.env.TAVILY_API_KEY || mduProviderSlugsDeep.length === 0) return [] as TavilyResult[]
        const propSlug = property_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        const slugSearches = mduProviderSlugsDeep
          .filter((p: any) => p.property_page_pattern || p.operator_page_pattern)
          .slice(0, 6)
          .map((p: any) => {
            const domain = ((p.property_page_pattern || p.operator_page_pattern || '') as string)
              .replace(/\{.*?\}/g, '').replace(/\/$/, '')
            const domainOnly = domain.replace(/^https?:\/\//, '').split('/')[0]
            if (!domainOnly) return Promise.resolve([] as TavilyResult[])
            return tavilySearch(`"${property_name}" site:${domainOnly}`, 2, 'provider-slug')
          })
        const results = await Promise.allSettled(slugSearches)
        return results
          .filter((r): r is PromiseFulfilledResult<TavilyResult[]> => r.status === 'fulfilled')
          .flatMap(r => r.value)
      })(),

      // Group B: SEC EDGAR full-text search (direct API — primary source)
      searchEdgar(property_name, mgmt),

      // Group C: State PUC dockets (targeted Tavily)
      searchPUC(property_name, address || '', state || ''),

      // Group D: City permit portals (targeted Tavily + Socrata)
      searchCityPermits(address || property_name, city || '', state || ''),

      // Group E: ISP MDU press releases (targeted Tavily)
      searchISPPressReleases(property_name, mgmt, location),
    ])

    // ── Merge + label all sources ────────────────────────────────────────
    // EDGAR, PUC, permit, and ISP press sources get higher base weight
    const tavilyAll = [
      ...ispResults, ...bulkResults, ...mgmtResults, ...redditResults,
      ...gateResults, ...proptechResults, ...residentTechResults,
      ...mgmtProptechResults, ...localIspResults, ...ownershipResults,
      ...(Array.isArray(providerSlugResultsDeep) ? providerSlugResultsDeep : []),
      ...pucResults, ...permitResults, ...ispPressResults,
    ]

    // Convert EDGAR results to TavilyResult shape for unified deduplication
    const edgarAsResults: TavilyResult[] = edgarResults.map(e => ({
      title: e.title,
      url: e.url,
      content: `[SEC EDGAR — PRIMARY SOURCE] ${e.content}`,
      score: e.score,
      source: e.source,
    }))

    const allResults = [...edgarAsResults, ...tavilyAll]

    // Deduplicate + rank — EDGAR gets score boost to always appear in top results
    const seenUrls = new Set<string>()
    const uniqueResults = allResults
      .filter(r => {
        if (seenUrls.has(r.url)) return false
        seenUrls.add(r.url)
        return r.score > 0.25
      })
      .sort((a, b) => {
        // provider-slug, EDGAR, PUC, permit sources rank first regardless of Tavily score
        const deepBoostSources: Record<string, number> = {
          'provider-slug': 0.4, EDGAR: 0.3, PUC: 0.3, CityPermit: 0.3, 'ISP-Press': 0.25,
        }
        const aBoost = deepBoostSources[a.source ?? ''] ?? 0
        const bBoost = deepBoostSources[b.source ?? ''] ?? 0
        return (b.score + bBoost) - (a.score + aBoost)
      })
      .slice(0, 20) // top 20 — more sources = more accurate synthesis

    if (uniqueResults.length === 0) {
      return NextResponse.json({
        isp_providers: [], video_providers: [], bulk_agreements: [],
        key_finding: 'No property-specific data found across all intelligence sources.',
        confidence: 'low', atlas_opportunity: false, edgar_signal: false, permit_signal: false,
        ownership: { owner_entity: 'Unknown', owner_type: 'unknown', portfolio_size: 'unknown', acquisition_year: 'unknown', capex_signal: '' },
        proptech: { gate_operators: [], access_control: [], intercoms: [], cameras: [], smart_locks: [], resident_apps: [], tech_generation: 'legacy', sara_signals: false, replacement_window: null, displacement_targets: [] },
        sources: [],
      })
    }

    // ── Format excerpts with source type labels ──────────────────────────
    const excerptBlock = uniqueResults.map((r, i) => {
      const sourceLabel = r.source ? `[${r.source.toUpperCase()}]` : '[WEB]'
      return `[Source ${i + 1}] ${sourceLabel} ${r.title}\nURL: ${r.url}\n${r.content.slice(0, 500)}`
    }).join('\n\n---\n\n')

    // Summarize which intelligence sources contributed
    const sourceTypes = [...new Set(uniqueResults.map(r => r.source ?? 'web').filter(Boolean))]
    const sourcesSummary = `Intelligence sources used: ${sourceTypes.join(', ')}`

    // ── Claude synthesizes all excerpts ─────────────────────────────────
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1536,
      tools: [deepIntelTool],
      tool_choice: { type: 'tool', name: 'aria_deep_intel_result' },
      system: `You are ARIA's deep connectivity, proptech, and ownership intelligence module. Your job is to extract ISP, MDU deal, property technology stack, and ownership/asset manager intelligence from multiple intelligence sources about a specific multifamily property.

SOURCE HIERARCHY — trust these in order:
1. [EDGAR] SEC filings — PRIMARY SOURCE. REITs disclose material bulk service agreements by name. Highest confidence.
2. [PUC] State Public Utility Commission filings — ISP ROW/conduit applications confirm physical presence. High confidence.
3. [CITYPERMIT] City permit records — ISP fiber/conduit permits confirm infrastructure installation. High confidence.
4. [ISP-PRESS] ISP press releases / partner portal announcements — ISPs announce MDU wins. Medium-high confidence.
5. [LISTING-SITE] Apartment listing amenity descriptions — "Internet by X" is a reliable amenity data point. Medium-high confidence.
6. [WEB] General web content — Reddit, reviews, news. Medium confidence, depends on specificity.

BULK AGREEMENT EXTRACTION — CRITICAL ACCURACY RULES:
⚠ NEVER guess the bulk provider based on which ISP is largest or most well-known in an area.
⚠ Local/regional ISPs (Gigastream, Sonic, Hotwire, WideOpenWest, Vyve, IgLou, Blue Ridge, Ting, Consolidated, TDS, Brightspeed, Metronet, Astound) frequently have MDU deals and may not be in your training data.
⚠ If any source names a small/unfamiliar ISP as the building's provider, TRUST IT over a national carrier assumption.
⚠ If an EDGAR filing names a specific ISP in a portfolio-wide bulk agreement — that is high-confidence even for individual properties.

Confidence rules:
- "high": EDGAR/PUC/permit source confirms it, OR source text explicitly states "internet included", "exclusive", "bulk deal", "building internet"
- "medium": listing site or ISP press release implies it, OR resident review says "only option is X" / "building deal with X"
- "low": inferred from market patterns, property class, or vintage alone — no source text
- Empty array []: return this if no property-specific evidence. Empty is CORRECT.
- evidence_source: always populate with the source type tag from brackets above

OWNERSHIP ANALYSIS:
- EDGAR is the gold standard for REIT ownership. Entity name in 10-K = confirmed owner.
- Look for acquisition signals: 8-K filings for property acquisitions, refinancing announcements, capex budget mentions
- Private equity firms (Blackstone, Morgan Properties, Starwood, Brookfield, KKR) often don't file property-level SEC data but appear in press coverage
- sec_filing_ref: if EDGAR confirmed ownership, record "EntityName — 10-K — YYYY-MM-DD"

key_finding: 1-2 sentences for a GateGuard sales rep. Format: "[WHO to call] at [company] controls capex for this property. [WHY NOW: deal expiry, acquisition, aging tech, SEC signal]." If no ownership found, lead with the strongest connectivity or proptech signal instead.

edgar_signal: set true if ANY EDGAR source provided useful information.
permit_signal: set true if ANY city permit or PUC source confirmed ISP infrastructure.`,

      messages: [{
        role: 'user',
        content: `Property: ${property_name}
Location: ${location}
Management Company: ${mgmt || 'unknown'}
${sourcesSummary}
${cachedDetectionsBlockDeep}
Intelligence excerpts (${uniqueResults.length} sources across EDGAR, PUC, city permits, ISP press releases, provider slug pages, and web):
${excerptBlock}

Extract all intelligence and call the aria_deep_intel_result tool.

CRITICAL REMINDER: Return bulk_agreements = [] if no property-specific evidence exists in these sources. Never infer from market patterns. Prioritize local/regional ISP names from listing sites over national carrier assumptions. EDGAR sources override all other confidence levels. [PROVIDER-SLUG-PAGE] source = ISP's own property portal page — treat as confirmed evidence (highest confidence).`,
      }],
    })

    const toolBlock = message.content.find(b => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined
    if (!toolBlock) throw new Error('No synthesis result from Claude')

    const intel = toolBlock.input as Record<string, any>

    // Build sources list with source type labels for UI display
    const sources = uniqueResults.slice(0, 8).map(r => ({
      title:   r.title,
      url:     r.url,
      excerpt: r.content.slice(0, 200),
      score:   r.score,
      type:    r.source ?? 'web',
    }))

    // Surface which premium intelligence sources contributed
    const intelligenceSources = {
      edgar:   edgarResults.length > 0,
      puc:     pucResults.length > 0,
      permits: permitResults.length > 0,
      isp_press: ispPressResults.length > 0,
      listing_sites: localIspResults.some(r => r.score > 0.4),
    }

    // Log deep search usage (non-blocking)
    void (async () => {
      try {
        const ggUser = await getCurrentUser()
        const scope  = await resolveOrgScope(ggUser)
        await supabaseDeep.from('aria_searches').insert({
          org_id:      scope.own_id ?? null,
          user_id:     ggUser?.id ?? null,
          user_name:   ggUser ? ggUser.name || ggUser.email || null : null,
          user_email:  ggUser?.email ?? null,
          search_type: 'deep',
          query:       `[DEEP] ${property_name}${location ? ` — ${location}` : ''}`,
          query_interpretation: `Deep intel on ${property_name}`,
          results:     { property_name, location, sources: sources.length },
        })
      } catch { /* non-blocking */ }
    })()

    // ── Persist provider detections (non-blocking) ──
    const deepAgreements: any[] = intel.bulk_agreements ?? []
    if (deepAgreements.length > 0) {
      void (async () => {
        try {
          const { data: allProviders } = await supabaseDeep
            .from('mdu_providers')
            .select('id, name')
            .eq('active', true)
          if (!allProviders) return

          const rows = deepAgreements
            .filter(a => ['high', 'confirmed'].includes(a.confidence ?? ''))
            .map((a: any) => {
              const provName = (a.provider ?? '').toLowerCase()
              const matched = (allProviders as any[]).find(
                (p: any) => (p.name as string).toLowerCase().includes(provName) || provName.includes((p.name as string).toLowerCase())
              )
              if (!matched) return null
              const yearMatch = (a.expiry_estimate ?? '').match(/20\d{2}/)
              return {
                provider_id:      matched.id,
                property_name:    property_name || null,
                property_address: address || null,
                confidence:       a.confidence === 'confirmed' ? 'confirmed' : 'high',
                source_type:      a.evidence_source ?? 'aria',
                source_snippet:   a.evidence ? (a.evidence as string).slice(0, 250) : null,
                contract_end_year: yearMatch ? parseInt(yearMatch[0], 10) : null,
                verified_by:      'aria',
              }
            })
            .filter(Boolean)

          if (rows.length > 0) {
            await supabaseDeep
              .from('mdu_provider_detections')
              .upsert(rows, { onConflict: 'provider_id,property_name', ignoreDuplicates: false })
          }
        } catch { /* non-blocking */ }
      })()
    }

    return NextResponse.json({ ...intel, sources, intelligence_sources: intelligenceSources })

  } catch (err: any) {
    console.error('[aria/research/deep]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
