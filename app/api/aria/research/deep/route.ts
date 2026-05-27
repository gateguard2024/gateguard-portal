/**
 * POST /api/aria/research/deep
 *
 * ARIA Deep Intel — multi-source property intelligence pipeline.
 * Runs after the initial ARIA result returns a known property name/address.
 *
 * Intelligence sources (all free or metered, run in parallel):
 *   A. Tavily web search  — 10 targeted queries across ISP, bulk, proptech, local ISPs, ownership
 *   B. SEC EDGAR EFTS     — REIT 10-K/10-Q filings disclose portfolio-wide bulk internet agreements
 *   C. State PUC search   — ISPs file for ROW/conduit access; PUC dockets reveal ISP infrastructure
 *   D. City permit search — Fiber/conduit permits confirm ISP physical presence in a building
 *   E. ISP MDU press      — ISP newsrooms announce MDU/bulk deal wins (Comcast Communities, etc.)
 *   F. Apollo.io          — Company + contact enrichment (APOLLO_API_KEY)
 *   G. Prospeo            — LinkedIn email finder for decision makers (PROSPEO_API_KEY)
 *   H. Proxycurl          — LinkedIn profile scraper for DM chain (PROXYCURL_API_KEY)
 *   I. People Data Labs   — Behavioral / psychographic enrichment (PDL_API_KEY)
 *
 * Claude Sonnet synthesizes all excerpts into structured output with citations.
 *
 * Cost: ~14 Tavily basic credits (~$0.112) + ~$0.003 Claude Sonnet + $0 for EDGAR/PUC/permit (free APIs)
 *       + API calls to Apollo/Prospeo/Proxycurl/PDL if keys configured (graceful fallback if not)
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

async function tavilySearch(
  query: string,
  maxResults = 5,
  source = 'web',
  search_time?: 'day' | 'week' | 'month' | 'year',
): Promise<TavilyResult[]> {
  if (!process.env.TAVILY_API_KEY) return []
  try {
    const body: Record<string, unknown> = {
      query,
      search_depth: 'basic',
      max_results: maxResults,
      include_answer: false,
      include_raw_content: false,
      include_images: false,
    }
    if (search_time) body.search_time = search_time
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TAVILY_API_KEY}`,
      },
      body: JSON.stringify(body),
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

// ─── Apollo.io — company + person enrichment ──────────────────────────────
// Apollo enriches management company records with contact hierarchy and
// org-level data. Used to find the asset manager / VP level contact.
// Gracefully returns {} if APOLLO_API_KEY not set.

interface ApolloEnrichment {
  name?: string
  title?: string
  email?: string
  phone_numbers?: string[]
  linkedin_url?: string
  organization?: { name?: string; website_url?: string }
}

async function apolloEnrichPerson(
  name: string,
  company: string,
  domain?: string,
): Promise<ApolloEnrichment | null> {
  if (!process.env.APOLLO_API_KEY) return null
  try {
    const res = await fetch('https://api.apollo.io/api/v1/people/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': process.env.APOLLO_API_KEY,
      },
      body: JSON.stringify({
        name,
        organization_name: company,
        domain,
        reveal_personal_emails: false,
        reveal_phone_number: false,
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.person ?? null
  } catch {
    return null
  }
}

async function apolloSearchContacts(
  company: string,
  titles: string[],
  location?: string,
): Promise<ApolloEnrichment[]> {
  if (!process.env.APOLLO_API_KEY) return []
  try {
    const res = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': process.env.APOLLO_API_KEY,
      },
      body: JSON.stringify({
        q_organization_name: company,
        person_titles: titles,
        person_locations: location ? [location] : [],
        per_page: 5,
      }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data?.people ?? []).slice(0, 5)
  } catch {
    return []
  }
}

// ─── Prospeo — LinkedIn email format finder ───────────────────────────────
// Given a LinkedIn profile URL or slug, returns the most likely email format
// and confidence score. Gracefully returns null if PROSPEO_API_KEY not set.

interface ProspeoResult {
  email?: string
  email_format?: string
  confidence?: number
  full_name?: string
  job_title?: string
  company?: string
  linkedin_url?: string
}

async function prospeoFindEmail(linkedinUrl: string): Promise<ProspeoResult | null> {
  if (!process.env.PROSPEO_API_KEY) return null
  try {
    const res = await fetch('https://api.prospeo.io/linkedin-email-finder', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-KEY': process.env.PROSPEO_API_KEY,
      },
      body: JSON.stringify({ url: linkedinUrl }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.response) return null
    return {
      email:        data.response.email ?? null,
      email_format: data.response.email_format ?? null,
      confidence:   data.response.confidence ?? null,
      full_name:    data.response.full_name ?? null,
      job_title:    data.response.job_title ?? null,
      company:      data.response.company ?? null,
      linkedin_url: linkedinUrl,
    }
  } catch {
    return null
  }
}

// ─── Proxycurl — LinkedIn profile scraper ─────────────────────────────────
// Fetches structured LinkedIn profile data including current/past roles,
// education, and skills. Used to build the DM hierarchy chain.
// Gracefully returns null if PROXYCURL_API_KEY not set.

interface ProxycurlProfile {
  full_name?: string
  headline?: string
  occupation?: string
  experiences?: Array<{
    company?: string
    title?: string
    starts_at?: { year?: number } | null
    ends_at?: { year?: number } | null   // null = current position
  }>
  email?: string
  personal_email?: string
}

async function proxycurlProfile(linkedinUrl: string): Promise<ProxycurlProfile | null> {
  if (!process.env.PROXYCURL_API_KEY) return null
  try {
    const params = new URLSearchParams({
      url: linkedinUrl,
      use_cache: 'if-recent',
      fallback_to_cache: 'on-error',
      skills: 'exclude',
      inferred_salary: 'exclude',
    })
    const res = await fetch(`https://nubela.co/proxycurl/api/v2/linkedin?${params}`, {
      headers: { Authorization: `Bearer ${process.env.PROXYCURL_API_KEY}` },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// ─── People Data Labs — behavioral / psychographic enrichment ─────────────
// PDL Person Enrichment returns professional history, education, skills,
// seniority, and inferred behavioral signals. Used for personality profiling
// and marketing pitch strategy. Gracefully returns null if PDL_API_KEY not set.

interface PDLPerson {
  full_name?: string
  job_title?: string
  job_title_role?: string
  job_title_levels?: string[]
  job_company_name?: string
  job_company_industry?: string
  inferred_salary?: string
  skills?: string[]
  education?: Array<{ school?: { name?: string }; degrees?: string[] }>
  experience?: Array<{ company?: { name?: string }; title?: { name?: string }; start_date?: string }>
  linkedin_url?: string
}

async function pdlEnrichPerson(
  name: string,
  company: string,
  email?: string,
): Promise<PDLPerson | null> {
  if (!process.env.PDL_API_KEY) return null
  try {
    const params = new URLSearchParams({
      name,
      company,
      pretty: 'false',
      titlecase: 'false',
    })
    if (email) params.set('email', email)
    const res = await fetch(`https://api.peopledatalabs.com/v5/person/enrich?${params}`, {
      headers: { 'X-Api-Key': process.env.PDL_API_KEY },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.data ?? null
  } catch {
    return null
  }
}

// ─── Temporal resident review search ─────────────────────────────────────
// Date-filtered searches on apartment review platforms and Reddit.
// The "year" search_time filter discards stale content, so a 2023 review
// about AT&T no longer poisons the result when Gigstreem took over in 2025.

async function searchResidentReviewsTemporal(
  propertyName: string,
  location: string,
): Promise<TavilyResult[]> {
  if (!process.env.TAVILY_API_KEY) return []
  const queries: Array<[string, 'year' | undefined]> = [
    // ApartmentRatings — most explicit about telecom and gate/security
    [`"${propertyName}" internet OR wifi OR "internet provider" OR gate OR "access control" site:apartmentratings.com`, 'year'],
    // Reddit communities — tenants complain about ISP contracts immediately after switches
    [`"${propertyName}" ${location} internet provider wifi site:reddit.com`, 'year'],
    // Any review site — recent provider switch signal
    [`"${propertyName}" "switched" OR "changed" internet OR wifi provider OR "Gigstreem" OR "managed wifi"`, 'year'],
    // ApartmentList + Apartments.com — amenity listings are updated when deals change
    [`"${propertyName}" ${location} "internet included" OR "wifi included" OR "bulk internet" site:apartmentlist.com OR site:apartments.com`, undefined],
  ]
  const results = await Promise.all(
    queries.map(([q, t]) => tavilySearch(q, 5, 'resident-review', t))
  )
  return results.flat()
}

// ─── Vendor footprint search ──────────────────────────────────────────────
// Managed-WiFi and regional ISPs frequently list their property clients
// as case studies on their own websites. This is the strongest possible
// confirmation of a bulk deal — the vendor is advertising it themselves.
// e.g. gigstreem.com/northland/wharf-7 = slam-dunk confirmation.

async function searchVendorFootprint(
  propertyName: string,
  managementCompany: string,
  location: string,
  dbProviderNames: string[] = [],
): Promise<TavilyResult[]> {
  if (!process.env.TAVILY_API_KEY) return []

  // Merge live DB names with hardcoded fallback list
  // The DB has 40+ providers; use first 20 in keyword queries (URL length limit)
  const fallbackProviders = [
    'Gigstreem', 'Managed WiFi', 'managed internet', 'SpectrumU',
    'Hotwire', 'Vyve', 'Sonic', 'WideOpenWest', 'WOW', 'TDS Telecom',
    'Metronet', 'Brightspeed', 'Astound', 'Pavlov Media', 'Single Digits',
    'MDU internet', 'community wifi', 'property-wide wifi', 'bulk wifi',
    'Boingo', 'Zentro', 'Dojo Networks', 'Launch Broadband',
  ]

  // Prefer DB names (live, authoritative) over fallback list
  const allProviders = dbProviderNames.length > 0
    ? [...new Set([...dbProviderNames, ...fallbackProviders])]
    : fallbackProviders

  // Use first 12 names for the main query string (keep URL reasonable)
  const providerKeywords = allProviders.slice(0, 12).join(' OR ')

  // Build site: constraints from known provider domains (from DB slug patterns)
  const knownDomains = [
    'gigstreem.com', 'spectrumu.com', 'pavlovmedia.com', 'singledigits.com',
    'hotwire.net', 'zentro.com', 'dojonetworks.com', 'boingo.com',
    'spotonnetworks.com', 'aerwave.com', 'launchbroadband.com',
  ].slice(0, 5).map(d => `site:${d}`).join(' OR ')

  const queries = [
    // Vendor lists this specific property as a case study on their own site (HIGHEST CONFIDENCE)
    `"${propertyName}" ${providerKeywords}`,
    // Management company + vendor partnership
    managementCompany
      ? `"${managementCompany}" ${providerKeywords} "case study" OR "partnership" OR "community" OR "units"`
      : `"${propertyName}" ${location} "managed wifi" OR "bulk internet" case study OR partnership`,
    // Vendor's own website — vendor-confirmed is highest confidence
    `"${propertyName}" OR "${managementCompany || propertyName}" ${knownDomains}`,
  ]

  const results = await Promise.all(
    queries.map(q => tavilySearch(q, 5, 'vendor-footprint'))
  )
  return results.flat()
}

// ─── Executive Truth Loop: ProxyCurl DM validation ───────────────────────
// Apollo returns the C-suite by title keyword, but its data can lag 6-12 months.
// Pattern: founder/chairman (Lawrence) and active CEO (Matthew) both match "CEO"
// in Apollo. ProxyCurl pulls the live LinkedIn "Experience" section and checks
// who holds "Present" status. The validated list overwrites stale Apollo data.

interface ValidatedDM {
  name: string
  currentTitle: string
  company: string
  email?: string
  linkedinUrl?: string
  confidence: 'proxycurl-verified' | 'apollo-only'
  isActiveCEO: boolean     // "Chief Executive" + no ends_at
  isFormerOrAdvisory: boolean // has ends_at or Founder/Chairman title
}

async function proxycurlValidateDMs(
  apolloContacts: ApolloEnrichment[],
): Promise<ValidatedDM[]> {
  const validated: ValidatedDM[] = []

  // Validate up to 3 contacts with LinkedIn URLs via ProxyCurl
  const withLinkedIn = apolloContacts.filter(c => c.linkedin_url).slice(0, 3)
  const withoutLinkedIn = apolloContacts.filter(c => !c.linkedin_url)

  let profiles: Array<ProxycurlProfile | null> = []

  if (process.env.PROXYCURL_API_KEY && withLinkedIn.length > 0) {
    const settled = await Promise.allSettled(
      withLinkedIn.map(c => proxycurlProfile(c.linkedin_url!))
    )
    profiles = settled.map(r => (r.status === 'fulfilled' ? r.value : null))
  }

  for (let i = 0; i < withLinkedIn.length; i++) {
    const c = withLinkedIn[i]
    const p = profiles[i]

    if (p) {
      // Find the current (no ends_at) experience
      const currentExp = (p.experiences ?? []).find(e => e.ends_at === null || e.ends_at === undefined)
      const currentTitle = currentExp?.title ?? p.occupation ?? c.title ?? ''
      const currentCompany = currentExp?.company ?? c.organization?.name ?? ''

      const titleLower = currentTitle.toLowerCase()
      const isActiveCEO = (titleLower.includes('chief executive') || titleLower.includes('ceo')) && !currentExp?.ends_at
      const isFormerOrAdvisory =
        titleLower.includes('founder') || titleLower.includes('chairman') ||
        titleLower.includes('advisor') || titleLower.includes('emeritus') ||
        !!(p.experiences ?? []).find(e => e.ends_at !== null && e.ends_at !== undefined && (e.title ?? '').toLowerCase().includes('ceo'))

      validated.push({
        name:               p.full_name ?? c.name ?? 'Unknown',
        currentTitle,
        company:            currentCompany,
        email:              p.email ?? p.personal_email ?? c.email,
        linkedinUrl:        c.linkedin_url,
        confidence:         'proxycurl-verified',
        isActiveCEO,
        isFormerOrAdvisory,
      })
    } else {
      // ProxyCurl failed — fall back to Apollo
      const titleLower = (c.title ?? '').toLowerCase()
      validated.push({
        name:               c.name ?? 'Unknown',
        currentTitle:       c.title ?? '',
        company:            c.organization?.name ?? '',
        email:              c.email,
        linkedinUrl:        c.linkedin_url,
        confidence:         'apollo-only',
        isActiveCEO:        titleLower.includes('ceo') || titleLower.includes('chief executive'),
        isFormerOrAdvisory: titleLower.includes('founder') || titleLower.includes('chairman'),
      })
    }
  }

  // Add contacts without LinkedIn as apollo-only
  for (const c of withoutLinkedIn) {
    const titleLower = (c.title ?? '').toLowerCase()
    validated.push({
      name:               c.name ?? 'Unknown',
      currentTitle:       c.title ?? '',
      company:            c.organization?.name ?? '',
      email:              c.email,
      confidence:         'apollo-only',
      isActiveCEO:        titleLower.includes('ceo') || titleLower.includes('chief executive'),
      isFormerOrAdvisory: titleLower.includes('founder') || titleLower.includes('chairman'),
    })
  }

  return validated
}

// ─── Review sentiment pre-pass (Haiku) ───────────────────────────────────
// Fast Haiku call on resident review snippets to extract structured signals
// BEFORE Claude Sonnet sees them. Turns raw review text into a clean block:
// "Provider switched from AT&T to Gigstreem in early 2025 — tenant complaints
//  about connectivity ongoing. Gate intercom mentioned as broken."
// This dramatically improves Sonnet synthesis accuracy on provider intel.

async function extractReviewSentiment(
  reviewResults: TavilyResult[],
  anthropicClient: Anthropic,
): Promise<string> {
  const usable = reviewResults
    .filter(r => r.content && r.content.length > 60)
    .slice(0, 8)
  if (usable.length === 0) return ''

  const snippets = usable
    .map((r, i) => `[Review ${i + 1}] ${r.title}\n${r.content.slice(0, 320)}`)
    .join('\n\n')

  try {
    const msg = await anthropicClient.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 450,
      messages: [{
        role: 'user',
        content: `Analyze these resident reviews and extract ONLY concrete factual signals:
1. Current internet provider(s) mentioned by name — especially small/regional ones
2. Any provider SWITCH or CHANGE mentioned (with approximate date if given)
3. Gate, intercom, or access control system mentions (brand names or problems)
4. Sentiment about connectivity: positive / negative / mixed
5. Any "only option" or "no choice" language suggesting a bulk/exclusive deal

Reviews:
${snippets}

Respond as 4-6 bullet points. Quote exact provider names. If a switch happened, note "Switched FROM [X] TO [Y] [approx date]". If no signal found for a category, skip it.`,
      }],
    })
    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
    return text ? `\n\nRESIDENT REVIEW SIGNALS (extracted from ${usable.length} recent reviews):\n${text}\n` : ''
  } catch {
    return ''
  }
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
      behavioral_profile: {
        type: 'object',
        description: 'Psychographic / communication profile of the primary decision maker based on PDL and web intel',
        properties: {
          personality_type:   { type: 'string', enum: ['analytical', 'driver', 'expressive', 'amiable'], description: 'DISC-style personality inferred from LinkedIn activity and role' },
          decision_style:     { type: 'string', enum: ['data-driven', 'relationship-driven', 'cost-driven', 'innovation-driven'], description: 'Primary driver for technology purchasing decisions' },
          risk_tolerance:     { type: 'string', enum: ['conservative', 'moderate', 'aggressive'], description: 'How quickly they adopt new vendors or technologies' },
          communication_pref: { type: 'string', enum: ['email', 'linkedin', 'phone', 'referral'], description: 'Most likely response channel based on role seniority and industry norms' },
        },
      },
      pitch_strategy: {
        type: 'object',
        description: 'Recommended outreach strategy for GateGuard sales based on all intel gathered',
        properties: {
          primary_hook:      { type: 'string', description: '1 sentence opening hook personalized to this prospect\'s primary pain point' },
          avoid_topics:      { type: 'array', items: { type: 'string' }, description: 'Topics/angles to avoid (e.g. if they just renewed a contract)' },
          best_time_to_call: { type: 'string', description: 'When to outreach based on contract window and news signals' },
          social_proof:      { type: 'string', description: 'Most relevant GateGuard reference property type (e.g. "similar Class A Greystar community in Dallas")' },
        },
      },
      freshness_score: {
        type: 'number',
        description: 'How fresh/actionable is this intelligence on a 1-5 scale. 5=very fresh (recent signals, news, SEC filing in past 90 days). 1=stale (no recent activity, old data only).',
      },
      buying_trends: {
        type: 'string',
        description: 'Any market trends or portfolio patterns that affect this prospect\'s likelihood to buy in the next 90 days (e.g. "Greystar announced Q1 capex push for access control across sunbelt portfolio")',
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

    const raw = await req.json()
    // Accept both raw query (from UI) and structured fields (from API)
    const property_name: string   = raw.property_name || raw.query || ''
    const address: string         = raw.address || ''
    const management_company: string = raw.management_company || ''
    const city: string            = raw.city || ''
    const state: string           = raw.state || ''

    if (!property_name) return NextResponse.json({ error: 'property_name or query required' }, { status: 400 })

    const location = [city, state].filter(Boolean).join(', ') || address || ''
    const mgmt = management_company || ''

    // ── Prefetch MDU provider DB + cached detections + prior contract findings ──
    let mduProviderSlugsDeep: Array<{ name: string; slug: string; property_page_pattern: string | null; operator_page_pattern: string | null; notes: string | null }> = []
    let mduAllProviderNames: string[] = []  // all active provider names for dynamic vendor searches
    let cachedDetectionsBlockDeep = ''
    let priorFindingsBlock = ''

    await Promise.allSettled([
      // Fetch providers with URL patterns for slug searches
      (async () => {
        try {
          const { data: providers } = await supabaseDeep
            .from('mdu_providers')
            .select('name, slug, property_page_pattern, operator_page_pattern, notes')
            .eq('active', true)
          if (providers) {
            mduProviderSlugsDeep = (providers as any[]).filter(p => p.property_page_pattern || p.operator_page_pattern)
            // All names for dynamic vendor footprint queries
            mduAllProviderNames = (providers as any[]).map(p => p.name)
          }
        } catch { /* non-blocking */ }
      })(),
      // Check cached provider detections for this property
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
      // Check aria_contract_findings for previously confirmed contracts at this property
      (async () => {
        try {
          const { data: findings } = await supabaseDeep
            .from('aria_contract_findings')
            .select('provider_name, agreement_type, service_type, expiry_year, expiry_date, confidence, source_type, source_snippet')
            .or(`property_name.ilike.%${property_name}%${address ? `,property_address.ilike.%${address}%` : ''}`)
            .in('confidence', ['confirmed', 'high', 'medium-high'])
            .order('created_at', { ascending: false })
            .limit(10)

          if (findings && findings.length > 0) {
            const lines = findings.map((f: any) => {
              const expiry = f.expiry_date
                ? ` (expires ${f.expiry_date})`
                : f.expiry_year ? ` (expires ~${f.expiry_year})` : ''
              const snippet = f.source_snippet ? `: "${f.source_snippet.slice(0, 100)}"` : ''
              return `• ${f.provider_name} — ${f.agreement_type} ${f.service_type}${expiry} [${f.confidence}] [${f.source_type}]${snippet}`
            })
            priorFindingsBlock = `\n\nGATEGUARD PRIOR CONTRACT FINDINGS for "${property_name}" (previously confirmed — treat as high-confidence baseline):\n${lines.join('\n')}\n`
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
      // Group F — Temporal resident reviews (date-filtered, site-targeted) — NEW
      temporalReviewResults,
      // Group G — Vendor footprint (managed-wifi / regional ISP case study pages) — NEW
      vendorFootprintResults,
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
      (async () => {
        if (!process.env.TAVILY_API_KEY || mduProviderSlugsDeep.length === 0) return [] as TavilyResult[]
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

      // Group F: Temporal resident reviews — last 12 months, site-targeted (NEW)
      searchResidentReviewsTemporal(property_name, location),

      // Group G: Vendor footprint — uses live mdu_providers names from DB (NEW)
      // If provider DB loaded, build dynamic query; otherwise fall back to hardcoded list
      searchVendorFootprint(property_name, mgmt, location, mduAllProviderNames),
    ])

    // ── Executive Truth Loop: Apollo → ProxyCurl validation → PDL enrichment ──
    // Step 1: Apollo wide net — find VP/Asset Manager/Director/CEO at mgmt company
    // Step 2: ProxyCurl validates each contact's current LinkedIn title in real-time
    //         Catches stale Apollo data (e.g., Founder/Chairman still tagged as CEO)
    // Step 3: PDL enriches the best verified DM for behavioral/psychographic profile

    const apolloContacts = mgmt
      ? await apolloSearchContacts(
          mgmt,
          ['Chief Executive Officer', 'CEO', 'President', 'Vice President', 'Asset Manager',
           'Regional Manager', 'Director', 'Portfolio Manager', 'Property Manager'],
          location,
        )
      : []

    // Step 2: ProxyCurl validation — verify current titles, detect chairman/advisor vs. active CEO
    const validatedDMs = await proxycurlValidateDMs(apolloContacts)

    // Step 3: PDL enrichment for the highest-confidence active decision maker
    const primaryDM = validatedDMs.find(d => d.isActiveCEO && d.confidence === 'proxycurl-verified')
      ?? validatedDMs.find(d => d.isActiveCEO)
      ?? validatedDMs.find(d => !d.isFormerOrAdvisory)
      ?? null

    const pdlDMProfile = primaryDM
      ? await pdlEnrichPerson(primaryDM.name, primaryDM.company, primaryDM.email)
      : null

    // Build verified DM block for synthesis prompt
    let apolloBlock = ''
    if (validatedDMs.length > 0) {
      const activeLines = validatedDMs
        .filter(d => !d.isFormerOrAdvisory)
        .map(d => {
          const badge = d.confidence === 'proxycurl-verified' ? '[VERIFIED via LinkedIn]' : '[Apollo only]'
          const emailStr = d.email ? ` <${d.email}>` : ''
          const liStr = d.linkedinUrl ? ` 🔗 ${d.linkedinUrl}` : ''
          return `• ${d.name} — ${d.currentTitle} at ${d.company}${emailStr}${liStr} ${badge}`
        })
      const advisoryLines = validatedDMs
        .filter(d => d.isFormerOrAdvisory)
        .map(d => `• ${d.name} — ${d.currentTitle} [FORMER/ADVISORY — do not cold-call as DM]`)

      if (activeLines.length > 0 || advisoryLines.length > 0) {
        apolloBlock = `\n\nEXECUTIVE TRUTH LOOP RESULTS for "${mgmt}" (ProxyCurl-verified where available):\n`
        if (activeLines.length > 0) apolloBlock += `ACTIVE DECISION MAKERS:\n${activeLines.join('\n')}\n`
        if (advisoryLines.length > 0) apolloBlock += `FORMER/ADVISORY (stale Apollo data — exclude from DM recommendation):\n${advisoryLines.join('\n')}\n`
      }
    }

    // ── Merge + label all sources ────────────────────────────────────────
    // EDGAR, PUC, permit, ISP press, vendor footprint, and verified reviews get higher weight
    const tavilyAll = [
      ...ispResults, ...bulkResults, ...mgmtResults, ...redditResults,
      ...gateResults, ...proptechResults, ...residentTechResults,
      ...mgmtProptechResults, ...localIspResults, ...ownershipResults,
      ...(Array.isArray(providerSlugResultsDeep) ? providerSlugResultsDeep : []),
      ...pucResults, ...permitResults, ...ispPressResults,
      ...temporalReviewResults,      // date-filtered resident reviews
      ...vendorFootprintResults,     // vendor case study pages
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

    // Deduplicate + rank — EDGAR, vendor footprint, recent reviews rank highest
    const seenUrls = new Set<string>()
    const uniqueResults = allResults
      .filter(r => {
        if (seenUrls.has(r.url)) return false
        seenUrls.add(r.url)
        return r.score > 0.25
      })
      .sort((a, b) => {
        const deepBoostSources: Record<string, number> = {
          'vendor-footprint': 0.45, // vendor's own site = highest confirmation
          'provider-slug':    0.40,
          EDGAR:              0.30,
          PUC:                0.30,
          CityPermit:         0.30,
          'ISP-Press':        0.25,
          'resident-review':  0.20, // date-filtered reviews rank above generic web
        }
        const aBoost = deepBoostSources[a.source ?? ''] ?? 0
        const bBoost = deepBoostSources[b.source ?? ''] ?? 0
        return (b.score + bBoost) - (a.score + aBoost)
      })
      .slice(0, 22) // slightly wider window to capture vendor + review sources

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

    // ── Haiku sentiment pre-pass on review snippets ──────────────────────
    // Run before Sonnet synthesis so the main prompt includes structured signals
    // rather than raw review text — cheaper and more accurate for Sonnet
    const reviewSnippets = uniqueResults.filter(r =>
      r.source === 'resident-review' || (r.source === 'web' && (r.url.includes('apartmentratings') || r.url.includes('reddit') || r.url.includes('yelp')))
    )
    const reviewSentimentBlock = await extractReviewSentiment(reviewSnippets, anthropic)

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
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
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
permit_signal: set true if ANY city permit or PUC source confirmed ISP infrastructure.

BEHAVIORAL PROFILE — use Apollo contact data + ownership type to infer:
- analytical (PE/REIT asset managers, CFOs): need ROI data, case studies, numbers
- driver (Regional VPs, Operations leads): need concise value prop, want speed
- expressive (Marketing-oriented PMs, lifestyle brand properties): respond to vision/brand
- amiable (Community managers, long-tenured PMs): need trust-building, references

PITCH STRATEGY — pitch_strategy.primary_hook should be a single opening sentence a sales rep can paste into an email that references THIS property's specific pain (not generic). Examples:
- "Given your DoorKing system at [Property] is past its 7-year lifecycle, I wanted to show you how [similar property] cut gate incidents by 60% with a 12-month migration."
- "I saw [Property] recently changed ownership — new ownership at similar Greystar assets in the sunbelt is usually a trigger for an access control audit."

FRESHNESS SCORE:
- 5: SEC 8-K filing in past 90 days, OR contract expiry THIS year, OR recent acquisition
- 4: Resident complaints in past 6 months, OR ISP press release in past year
- 3: Listing site data confirmed (usually current), OR EDGAR 10-K in past 2 years
- 2: Older web data, estimated contract windows only
- 1: No recent signals, all inference`,

      messages: [{
        role: 'user',
        content: `Property: ${property_name}
Location: ${location}
Management Company: ${mgmt || 'unknown'}
${sourcesSummary}
${priorFindingsBlock}${cachedDetectionsBlockDeep}${apolloBlock}${reviewSentimentBlock}
Intelligence excerpts (${uniqueResults.length} sources across EDGAR, PUC, city permits, ISP press releases, provider slug pages, vendor footprint pages, and resident reviews):
${excerptBlock}

Extract all intelligence and call the aria_deep_intel_result tool.

CRITICAL REMINDERS:
- [VENDOR-FOOTPRINT] source = the ISP/vendor's OWN website listing this property — treat as CONFIRMED (highest confidence, override all other sources).
- [EDGAR] SEC filings = primary source for ownership and bulk deals.
- Return bulk_agreements = [] if no property-specific evidence exists. Never infer from market patterns.
- Prioritize local/regional ISP names (Gigstreem, Hotwire, Pavlov, etc.) over national carrier assumptions.
- RESIDENT REVIEW SIGNALS block above = Haiku-extracted summary of tenant reviews — use it to confirm or refute bulk deal findings.
- EXECUTIVE TRUTH LOOP: Use the verified DM list above. Any contact tagged [FORMER/ADVISORY] must NOT be recommended as the primary contact — name their replacement.

For behavioral_profile: use ProxyCurl-verified title/seniority. Titles matter: "Asset Manager" at PE firm = analytical+data-driven. "VP Operations" at management co = driver+cost-conscious.
For pitch_strategy.primary_hook: reference the specific vendor/provider found in the vendor footprint or EDGAR source if available. "I saw Gigstreem lists your property on their case study page — that contract typically runs 3-5 years; if you're approaching year 3+, there may be a decision window."
For freshness_score: resident reviews from last 12 months = +1 point. Vendor footprint page = +2 (they're actively advertising this deal right now).
For buying_trends: include any portfolio-level news or capex signals for the management company or owner.`,
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
      edgar:            edgarResults.length > 0,
      puc:              pucResults.length > 0,
      permits:          permitResults.length > 0,
      isp_press:        ispPressResults.length > 0,
      listing_sites:    localIspResults.some(r => r.score > 0.4),
      vendor_footprint: vendorFootprintResults.length > 0,
      resident_reviews: temporalReviewResults.length > 0,
      apollo:           apolloContacts.length > 0,
      proxycurl_verified: validatedDMs.some(d => d.confidence === 'proxycurl-verified'),
      pdl:              pdlDMProfile !== null,
      dm_verified_count: validatedDMs.filter(d => !d.isFormerOrAdvisory).length,
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

    // ── Persist to aria_properties intelligence DB (non-blocking) ────────────
    void (async () => {
      try {
        // Build a prospect-shaped object matching what /api/aria/properties POST expects
        const prospectPayload = {
          property: {
            name:                property_name,
            address:             address || location || property_name,
            units:               null,
            property_type:       null,
            class:               null,
            year_built:          null,
            management_company:  mgmt || null,
            owner_entity:        intel.ownership?.owner_entity ?? null,
            isp_providers:       intel.isp_providers ?? [],
            video_providers:     intel.video_providers ?? [],
            bulk_agreements:     intel.bulk_agreements ?? [],
            _fcc_verified:       intelligenceSources.edgar || intelligenceSources.permits,
            proptech:            intel.proptech ?? {},
          },
          decision_maker: intel.ownership?.asset_manager ?? {},
          decision_maker_chain: [],
          ownership: intel.ownership ? {
            owner_entity:     intel.ownership.owner_entity ?? null,
            owner_type:       intel.ownership.owner_type ?? null,
            portfolio_size:   intel.ownership.portfolio_size ?? null,
            acquisition_year: intel.ownership.acquisition_year ?? null,
            capex_signal:     intel.ownership.capex_signal ?? null,
          } : null,
          pain_signals: [],
          profile: {
            buy_score:           intel.freshness_score ? Math.round(intel.freshness_score * 1.5 + 2) : 5,
            urgency:             'medium',
            primary_concern:     intel.key_finding?.slice(0, 80) ?? null,
            current_vendor:      (intel.bulk_agreements?.[0] as any)?.provider ?? null,
            contract_window:     (intel.bulk_agreements?.[0] as any)?.expiry_estimate ?? null,
            communication_style: intel.behavioral_profile?.communication_pref ?? null,
          },
          behavioral_profile: intel.behavioral_profile ?? null,
          pitch_strategy:     intel.pitch_strategy ?? null,
          freshness_score:    intel.freshness_score ?? null,
          scout_brief: {
            primary_contact: intel.ownership?.asset_manager?.name ?? mgmt ?? property_name,
            outreach_angle: intel.atlas_opportunity ? 'contract_window' : 'tech_displacement',
            contract_window_urgency: 'medium' as const,
            key_data_points: intel.key_finding ? [intel.key_finding] : [],
          },
        }

        await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/aria/properties`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prospects: [prospectPayload] }),
        })
      } catch { /* non-blocking, never fail the main response */ }
    })()

    return NextResponse.json({ ...intel, sources, intelligence_sources: intelligenceSources })

  } catch (err: any) {
    console.error('[aria/research/deep]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
