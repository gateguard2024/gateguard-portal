/**
 * POST /api/aria/research/deep
 *
 * ARIA Deep Intel — multi-source property intelligence pipeline.
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

interface TavilyResult { title: string; url: string; content: string; score: number; source?: string }
interface TavilyResponse { results: TavilyResult[]; answer?: string }

async function tavilySearch(query: string, maxResults = 5, source = 'web', search_time?: 'day' | 'week' | 'month' | 'year', depth: 'basic' | 'advanced' = 'basic'): Promise<TavilyResult[]> {
  if (!process.env.TAVILY_API_KEY) return []
  try {
    const body: Record<string, unknown> = {
      query, search_depth: depth, max_results: maxResults, include_answer: false, include_raw_content: false, include_images: false,
    }
    if (search_time) body.search_time = search_time
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.TAVILY_API_KEY}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return []
    const data: TavilyResponse = await res.json()
    return (data.results ?? []).map(r => ({ ...r, source }))
  } catch { return [] }
}

// ─── SEC EDGAR full-text search ───────────────────────────────────────────

interface EdgarResult { title: string; url: string; content: string; score: number; source: string }

async function searchEdgar(propertyName: string, managementCompany: string): Promise<EdgarResult[]> {
  const results: EdgarResult[] = []
  const queries = [
    `"${propertyName}" "bulk internet" OR "MDU agreement" OR "exclusive internet" OR "bulk broadband"`,
    managementCompany ? `"${managementCompany}" "MDU" "internet" "exclusive" OR "bulk agreement" OR "preferred provider"` : null,
  ].filter(Boolean) as string[]

  for (const q of queries) {
    try {
      const url = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(q)}&forms=10-K%2C10-Q%2C8-K&dateRange=custom&startdt=2018-01-01`
      const res = await fetch(url, { headers: { 'User-Agent': 'GateGuard-ARIA/1.0' }, signal: AbortSignal.timeout(8000) })
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
        const edgarUrl = accNum ? `https://www.sec.gov/Archives/edgar/data/${hit._source?.entity_id}/${accNum.replace(/-/g, '')}/` : `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(q)}&forms=10-K%2C10-Q`
        results.push({
          title: `${entity} — ${form} (${fileDate})`,
          url: edgarUrl,
          content: highlights.slice(0, 2).map((h: string) => h.replace(/<\/?em>/g, '**')).join(' ... '),
          score: 0.75, source: 'EDGAR',
        })
      }
    } catch { }
  }
  return results
}

// ─── State PUC search via Tavily ──────────────────────────────────────────

async function searchPUC(propertyName: string, address: string, state: string): Promise<TavilyResult[]> {
  if (!process.env.TAVILY_API_KEY || !state) return []
  const pucDomains: Record<string, string> = { FL: 'floridapsc.com', TX: 'puc.texas.gov', GA: 'psc.state.ga.us', NC: 'ncuc.net', TN: 'tn.gov/puc', CA: 'cpuc.ca.gov', NY: 'dps.ny.gov', VA: 'scc.virginia.gov', AZ: 'azcc.gov', CO: 'puc.colorado.gov' }
  const stateAbbr = state.trim().toUpperCase().slice(0, 2)
  const pucDomain = pucDomains[stateAbbr]

  const queries = [
    `${address || propertyName} ${state} ISP internet "right of way" OR "conduit" OR "MDU" fiber telecom permit site:${pucDomain || 'gov'}`,
    `"${address || propertyName}" ${state} public utility commission internet provider filing`,
  ]
  const pucResults = await Promise.all(queries.slice(0, pucDomain ? 1 : 1).map(q => tavilySearch(q, 3, 'PUC')))
  return pucResults.flat()
}

// ─── City permit search via Tavily + Socrata ──────────────────────────────

async function searchCityPermits(address: string, city: string, state: string): Promise<TavilyResult[]> {
  if (!process.env.TAVILY_API_KEY || !city) return []
  const cityLower = city.toLowerCase()
  const openDataCities: Record<string, string> = { atlanta: 'data.atlantaga.gov', nashville: 'data.nashville.gov', dallas: 'dallasopendata.com', austin: 'data.austintexas.gov', charlotte: 'data.charlottenc.gov', phoenix: 'data.phoenix.gov', denver: 'denvergov.org/opendata', raleigh: 'data-ral.opendata.arcgis.com', miami: 'gis.miamifl.gov', tampa: 'data.tampagov.net' }
  const matchedCity = Object.keys(openDataCities).find(c => cityLower.includes(c))
  const portalDomain = matchedCity ? openDataCities[matchedCity] : null

  const queries = [
    portalDomain ? `${address} telecommunications OR fiber OR conduit permit site:${portalDomain}` : `${address} ${city} ${state} ISP fiber conduit permit "telecommunications" filetype:html`,
    `"${address}" OR "${city} ${state}" ISP internet fiber permit "Comcast" OR "Spectrum" OR "AT&T" OR "telecom" construction permit`,
  ]
  const permitResults = await Promise.all(queries.map(q => tavilySearch(q, 3, 'CityPermit')))
  return permitResults.flat()
}

// ─── ISP MDU press release search ─────────────────────────────────────────

async function searchISPPressReleases(propertyName: string, managementCompany: string, location: string): Promise<TavilyResult[]> {
  if (!process.env.TAVILY_API_KEY) return []
  const queries = [
    `"${propertyName}" OR "${managementCompany}" "Comcast Communities" OR "Xfinity Communities" OR "Spectrum Communities" OR "AT&T Smart Communities" OR "Lumen MDU" OR "Frontier MDU" internet deal announcement`,
    `"${propertyName}" OR "${managementCompany}" ${location} internet provider "partnership" OR "agreement" OR "deal" OR "service agreement" multifamily apartment`,
    managementCompany ? `"${managementCompany}" internet OR broadband "portfolio" OR "exclusive" OR "bulk" agreement announcement` : `"${propertyName}" ${location} internet bulk "agreement" OR "partnership" announcement`,
  ]
  const pressResults = await Promise.all(queries.map(q => tavilySearch(q, 3, 'ISP-Press')))
  return pressResults.flat()
}

// ─── Apollo.io — company + person enrichment ──────────────────────────────

interface ApolloEnrichment { name?: string; title?: string; email?: string; phone_numbers?: string[]; linkedin_url?: string; organization?: { name?: string; website_url?: string } }

async function apolloSearchContacts(company: string, titles: string[], location?: string): Promise<ApolloEnrichment[]> {
  if (!process.env.APOLLO_API_KEY) return []
  try {
    const res = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': process.env.APOLLO_API_KEY },
      body: JSON.stringify({ q_organization_name: company, person_titles: titles, person_locations: location ? [location] : [], per_page: 5 }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data?.people ?? []).slice(0, 5)
  } catch { return [] }
}

// ─── Proxycurl — LinkedIn profile scraper ─────────────────────────────────

interface ProxycurlProfile { full_name?: string; headline?: string; occupation?: string; experiences?: Array<{ company?: string; title?: string; starts_at?: { year?: number } | null; ends_at?: { year?: number } | null }>; email?: string; personal_email?: string }

async function proxycurlProfile(linkedinUrl: string): Promise<ProxycurlProfile | null> {
  if (!process.env.PROXYCURL_API_KEY) return null
  try {
    const params = new URLSearchParams({ url: linkedinUrl, use_cache: 'if-recent', fallback_to_cache: 'on-error', skills: 'exclude', inferred_salary: 'exclude' })
    const res = await fetch(`https://nubela.co/proxycurl/api/v2/linkedin?${params}`, { headers: { Authorization: `Bearer ${process.env.PROXYCURL_API_KEY}` }, signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

// ─── People Data Labs — behavioral / psychographic enrichment ─────────────

interface PDLPerson { full_name?: string; job_title?: string; job_company_name?: string; skills?: string[]; linkedin_url?: string }

async function pdlEnrichPerson(name: string, company: string, email?: string): Promise<PDLPerson | null> {
  if (!process.env.PDL_API_KEY) return null
  try {
    const params = new URLSearchParams({ name, company, pretty: 'false', titlecase: 'false' })
    if (email) params.set('email', email)
    const res = await fetch(`https://api.peopledatalabs.com/v5/person/enrich?${params}`, { headers: { 'X-Api-Key': process.env.PDL_API_KEY }, signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const data = await res.json()
    return data?.data ?? null
  } catch { return null }
}

// ─── Temporal resident review search ─────────────────────────────────────

async function searchResidentReviewsTemporal(propertyName: string, location: string): Promise<TavilyResult[]> {
  if (!process.env.TAVILY_API_KEY) return []
  // Advanced depth on review/listing sites — these are JS-rendered (React SPAs).
  // 'advanced' uses Tavily's headless browser and sees dynamic content like
  // mandatory fee line items, actual review text, and "Technology Package" charges.
  const queries: Array<[string, 'year' | undefined, 'basic' | 'advanced']> = [
    [`"${propertyName}" internet OR wifi OR "internet provider" OR gate OR "access control" site:apartmentratings.com`, 'year', 'advanced'],
    [`"${propertyName}" site:yelp.com reviews internet wifi provider fee`, undefined, 'advanced'],
    [`"${propertyName}" ${location} internet provider wifi "no choice" OR "forced" OR "mandatory" OR "included in rent"`, 'year', 'advanced'],
    [`"${propertyName}" "switched" OR "changed" internet OR wifi provider OR "Gigstreem" OR "managed wifi"`, 'year', 'basic'],
    // apartments.com fees/policies tab — JS-rendered, shows mandatory Technology Package fees by provider name
    [`"${propertyName}" "technology fee" OR "wifi fee" OR "internet fee" OR "Gigstreem" OR "managed wifi" site:apartments.com OR site:apartmentlist.com`, undefined, 'advanced'],
  ]
  const results = await Promise.all(queries.map(([q, t, d]) => tavilySearch(q, 5, 'resident-review', t, d)))
  return results.flat()
}

// ─── PHASE 1: Property discovery (catches typos, finds real name) ─────────

async function discoverProperty(rawQuery: string): Promise<TavilyResult[]> {
  if (!process.env.TAVILY_API_KEY) return []
  const results = await Promise.all([
    // With quotes: exact match on real indexed name
    tavilySearch(`"${rawQuery}" apartments address units management`, 5, 'discovery'),
    // Without quotes: fuzzy, catches misspellings like "warf" → "wharf"
    tavilySearch(`${rawQuery} apartments address units`, 5, 'discovery'),
    // Listing sites: most reliable for address, units, year built
    tavilySearch(`"${rawQuery}" site:apartments.com OR site:zillow.com OR site:rentcafe.com OR site:rent.com OR site:apartmentfinder.com`, 5, 'listing-site'),
    // Ownership / acquisition press
    tavilySearch(`"${rawQuery}" OR "${rawQuery.replace(/\d+/, '').trim()}" apartment acquired ownership management company`, 4, 'discovery'),
    // Catch alternate spellings via broad search
    tavilySearch(`${rawQuery} apartment community charleston OR atlanta OR dallas OR denver OR phoenix OR austin OR raleigh`, 4, 'web'),
  ])
  return results.flat()
}

// ─── PHASE 1 → Haiku: Extract real property facts ─────────────────────────

interface ExtractedPropertyFacts {
  corrected_name:     string
  address:            string
  city:               string
  state:              string
  units:              number | null
  year_built:         number | null
  property_class:     string | null
  management_company: string
  owner:              string
  isp_hints:          string[]
}

async function extractPropertyFacts(results: TavilyResult[], rawQuery: string, client: Anthropic): Promise<ExtractedPropertyFacts> {
  const blank: ExtractedPropertyFacts = {
    corrected_name: rawQuery, address: '', city: '', state: '',
    units: null, year_built: null, property_class: null,
    management_company: '', owner: '', isp_hints: [],
  }
  const usable = results.filter(r => r.content?.length > 40).slice(0, 14)
  if (usable.length === 0) return blank
  const snippets = usable.map((r, i) => `[${i + 1}] ${r.title}\n${r.content.slice(0, 350)}`).join('\n\n---\n\n')

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `The user searched for: "${rawQuery}"
The user may have misspelled the property name. Use the search results below to find the CORRECT property name, full address, unit count, and owner/management company.

Search results:
${snippets}

Return ONLY valid JSON — no commentary:
{
  "corrected_name": "exact correct property name",
  "address": "full street address",
  "city": "city name",
  "state": "2-letter state code",
  "units": null or integer,
  "year_built": null or 4-digit year,
  "property_class": null or "A", "B", or "C",
  "management_company": "management company name or empty string",
  "owner": "owner/investor entity name or empty string",
  "isp_hints": ["any ISP or internet provider names mentioned, including bulk/managed wifi hints"]
}`,
      }],
    })
    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : '{}'
    const match = text.match(/\{[\s\S]+\}/)
    if (match) {
      const parsed = JSON.parse(match[0]) as ExtractedPropertyFacts
      // Only accept corrected_name if it looks like a real correction, not gibberish
      if (!parsed.corrected_name || parsed.corrected_name.length < 2) parsed.corrected_name = rawQuery
      return parsed
    }
  } catch { /* fall through to blank */ }
  return blank
}

// ─── Query type classification ────────────────────────────────────────────

type QueryType = 'named_property' | 'prospecting_query'

interface QueryClassification {
  type: QueryType
  extracted_city: string
  extracted_state: string
  criteria_summary: string // e.g. "500+ units, bulk internet, gated, contract expiring"
}

async function classifyQuery(rawQuery: string, client: Anthropic): Promise<QueryClassification> {
  const fallback: QueryClassification = { type: 'named_property', extracted_city: '', extracted_state: '', criteria_summary: '' }
  // Quick heuristic — if it looks like criteria language, skip the expensive Haiku call
  const prospectingPatterns = /\b(find|looking for|any|HOA|apartment.*(with|near|in)|criteria|more than|over|units|contract expir|bulk internet|gated)\b/i
  if (!prospectingPatterns.test(rawQuery)) return fallback
  // If it also contains specific markers of a real name (quotes, or 2-3 words that look like a proper noun), stay as named_property
  if (rawQuery.trim().split(/\s+/).length <= 4 && !/\b(HOA|find|looking|criteria)\b/i.test(rawQuery)) return fallback

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Classify this ARIA search query. Is it: (A) the name of a specific apartment property (e.g. "AMLI Marina Del Rey", "Northland Wharf 7"), or (B) a criteria-based prospecting query looking for properties matching certain attributes (e.g. "HOA in Atlanta with 500+ units and bulk internet")?

Query: "${rawQuery}"

Return ONLY valid JSON:
{"type":"named_property"|"prospecting_query","extracted_city":"city or empty","extracted_state":"2-letter state or empty","criteria_summary":"brief summary of criteria, or empty if named_property"}`
      }]
    })
    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : '{}'
    const match = text.match(/\{[\s\S]+\}/)
    if (match) {
      const parsed = JSON.parse(match[0]) as QueryClassification
      return parsed
    }
  } catch { /* fallback to named_property */ }
  return fallback
}

// ─── Prospecting: find specific candidate properties ──────────────────────

async function findCandidateProperties(rawQuery: string, city: string, state: string, criteria: string): Promise<TavilyResult[]> {
  if (!process.env.TAVILY_API_KEY) return []
  const geo = [city, state].filter(Boolean).join(', ') || 'Atlanta, GA'
  const queries = [
    // Direct: find named apartment communities matching the criteria
    `${geo} apartment community gated 500 units "bulk internet" OR "internet included" OR "managed wifi" site:apartments.com OR site:rentcafe.com`,
    // Broader: no site restriction
    `${geo} luxury gated apartment complex 500 units bulk internet OR "internet included" property management`,
    // HOA/condo angle
    `${geo} HOA condominium complex 500+ units gated internet included gate access control`,
    // Awards / rankings often name large communities
    `${geo} "best apartments" OR "luxury community" 500 units gated internet amenities 2024 OR 2025`,
    // List pages — directory of large apartment communities in city
    `${geo} apartment communities list 500+ units gated access control OR gate operator amenities`,
  ]
  const results = await Promise.all(queries.map(q => tavilySearch(q, 5, 'prospect-discovery')))
  return results.flat()
}

// ─── Extract candidate property names from prospecting results ─────────────

async function extractCandidateNames(results: TavilyResult[], rawQuery: string, city: string, client: Anthropic): Promise<string[]> {
  const usable = results.filter(r => r.content?.length > 40).slice(0, 16)
  if (usable.length === 0) return []
  const snippets = usable.map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content.slice(0, 300)}`).join('\n\n---\n\n')

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `The user is looking for: "${rawQuery}"

From these search results, extract the names of SPECIFIC apartment communities or HOA complexes in ${city || 'the target city'} that appear to match the criteria. Focus on properties that seem large (400+ units), gated or have access control, and may have bulk internet.

Search results:
${snippets}

Return ONLY valid JSON — a list of up to 3 specific property names:
{"candidates": ["Property Name 1", "Property Name 2", "Property Name 3"]}`
      }]
    })
    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : '{}'
    const match = text.match(/\{[\s\S]+\}/)
    if (match) {
      const parsed = JSON.parse(match[0]) as { candidates: string[] }
      return (parsed.candidates ?? []).filter((n: string) => n && n.length > 2).slice(0, 3)
    }
  } catch { /* return empty */ }
  return []
}

// ─── Targeted contact search ──────────────────────────────────────────────

async function searchContacts(mgmtCompany: string, owner: string, city: string, state: string): Promise<TavilyResult[]> {
  if (!process.env.TAVILY_API_KEY || (!mgmtCompany && !owner)) return []
  const entity = mgmtCompany || owner
  const geo = [city, state].filter(Boolean).join(', ')

  const queries = [
    // theorg.com has org charts with names and titles
    `site:theorg.com "${entity}"`,
    // RocketReach has contact info
    `"${entity}" "regional property manager" OR "community manager" OR "asset manager" site:rocketreach.co OR site:zoominfo.com`,
    // LinkedIn people search with location
    `"${entity}" "property manager" OR "regional manager" OR "community manager" ${geo} site:linkedin.com`,
    // Direct contact search
    `"${entity}" property management team ${geo} director OR manager email contact`,
    // Northland/REIT/PE specific: their leadership page
    `"${entity}" leadership team multifamily property management about`,
  ]
  const results = await Promise.all(queries.map(q => tavilySearch(q, 4, 'contact-search')))
  return results.flat()
}

// ─── Vendor footprint search ──────────────────────────────────────────────

async function searchVendorFootprint(propertyName: string, managementCompany: string, location: string, dbProviderNames: string[] = []): Promise<TavilyResult[]> {
  if (!process.env.TAVILY_API_KEY) return []
  const fallbackProviders = ['Gigstreem', 'Managed WiFi', 'managed internet', 'SpectrumU', 'Hotwire', 'Vyve', 'Sonic', 'WideOpenWest', 'WOW', 'TDS Telecom', 'Metronet', 'Brightspeed', 'Astound', 'Pavlov Media', 'Single Digits', 'Boingo', 'Zentro']
  const allProviders = dbProviderNames.length > 0 ? [...new Set([...dbProviderNames, ...fallbackProviders])] : fallbackProviders
  const providerKeywords = allProviders.slice(0, 12).join(' OR ')
  const knownDomains = ['gigstreem.com', 'spectrumu.com', 'pavlovmedia.com', 'singledigits.com', 'hotwire.net', 'zentro.com', 'dojonetworks.com'].map(d => `site:${d}`).join(' OR ')

  const queries: Array<[string, 'basic' | 'advanced']> = [
    [`"${propertyName}" ${providerKeywords}`, 'basic'],
    [managementCompany ? `"${managementCompany}" ${providerKeywords} "case study" OR "partnership" OR "community" OR "units"` : `"${propertyName}" ${location} "managed wifi" OR "bulk internet" case study OR partnership`, 'basic'],
    // Advanced: ISP domains like gigstreem.com/paseo-at-bee-cave/ are Webflow/JS — need headless to see property-specific pages
    [`"${propertyName}" OR "${managementCompany || propertyName}" ${knownDomains}`, 'advanced'],
  ]
  const results = await Promise.all(queries.map(([q, d]) => tavilySearch(q, 5, 'vendor-footprint', undefined, d)))
  return results.flat()
}

// ─── Executive Truth Loop: ProxyCurl DM validation ───────────────────────

interface ValidatedDM { name: string; currentTitle: string; company: string; email?: string; linkedinUrl?: string; confidence: 'proxycurl-verified' | 'apollo-only'; isActiveCEO: boolean; isFormerOrAdvisory: boolean }

async function proxycurlValidateDMs(apolloContacts: ApolloEnrichment[]): Promise<ValidatedDM[]> {
  const validated: ValidatedDM[] = []
  const withLinkedIn = apolloContacts.filter(c => c.linkedin_url).slice(0, 3)
  const withoutLinkedIn = apolloContacts.filter(c => !c.linkedin_url)
  let profiles: Array<ProxycurlProfile | null> = []

  if (process.env.PROXYCURL_API_KEY && withLinkedIn.length > 0) {
    const settled = await Promise.allSettled(withLinkedIn.map(c => proxycurlProfile(c.linkedin_url!)))
    profiles = settled.map(r => (r.status === 'fulfilled' ? r.value : null))
  }

  for (let i = 0; i < withLinkedIn.length; i++) {
    const c = withLinkedIn[i]; const p = profiles[i]
    if (p) {
      const currentExp = (p.experiences ?? []).find(e => e.ends_at === null || e.ends_at === undefined)
      const currentTitle = currentExp?.title ?? p.occupation ?? c.title ?? ''
      const currentCompany = currentExp?.company ?? c.organization?.name ?? ''
      const titleLower = currentTitle.toLowerCase()
      const isActiveCEO = (titleLower.includes('chief executive') || titleLower.includes('ceo')) && !currentExp?.ends_at
      const isFormerOrAdvisory = titleLower.includes('founder') || titleLower.includes('chairman') || titleLower.includes('advisor') || !!(p.experiences ?? []).find(e => e.ends_at !== null && e.ends_at !== undefined && (e.title ?? '').toLowerCase().includes('ceo'))
      validated.push({ name: p.full_name ?? c.name ?? 'Unknown', currentTitle, company: currentCompany, email: p.email ?? p.personal_email ?? c.email, linkedinUrl: c.linkedin_url, confidence: 'proxycurl-verified', isActiveCEO, isFormerOrAdvisory })
    } else {
      const titleLower = (c.title ?? '').toLowerCase()
      validated.push({ name: c.name ?? 'Unknown', currentTitle: c.title ?? '', company: c.organization?.name ?? '', email: c.email, linkedinUrl: c.linkedin_url, confidence: 'apollo-only', isActiveCEO: titleLower.includes('ceo') || titleLower.includes('chief executive'), isFormerOrAdvisory: titleLower.includes('founder') || titleLower.includes('chairman') })
    }
  }

  for (const c of withoutLinkedIn) {
    const titleLower = (c.title ?? '').toLowerCase()
    validated.push({ name: c.name ?? 'Unknown', currentTitle: c.title ?? '', company: c.organization?.name ?? '', email: c.email, confidence: 'apollo-only', isActiveCEO: titleLower.includes('ceo') || titleLower.includes('chief executive'), isFormerOrAdvisory: titleLower.includes('founder') || titleLower.includes('chairman') })
  }
  return validated
}

// ─── Review sentiment pre-pass (Haiku) ───────────────────────────────────

async function extractReviewSentiment(reviewResults: TavilyResult[], anthropicClient: Anthropic): Promise<string> {
  const usable = reviewResults.filter(r => r.content && r.content.length > 60).slice(0, 8)
  if (usable.length === 0) return ''
  const snippets = usable.map((r, i) => `[Review ${i + 1}] ${r.title}\n${r.content.slice(0, 320)}`).join('\n\n')

  try {
    const msg = await anthropicClient.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 450,
      messages: [{ role: 'user', content: `Analyze these resident reviews and extract ONLY concrete factual signals: 1. Current internet provider 2. Any provider SWITCH mentioned 3. Gate/intercom problems 4. Connectivity sentiment\nReviews:\n${snippets}` }],
    })
    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
    return text ? `\n\nRESIDENT REVIEW SIGNALS:\n${text}\n` : ''
  } catch { return '' }
}

// ─── Deep intel synthesis tool ────────────────────────────────────────────

const deepIntelTool: Anthropic.Tool = {
  name: 'aria_deep_intel_result',
  description: 'Return the structured deep connectivity, proptech, and ownership intelligence for this property.',
  input_schema: {
    type: 'object' as const,
    required: ['property_details', 'isp_providers', 'video_providers', 'bulk_agreements', 'extracted_contacts', 'key_finding', 'confidence', 'proptech', 'pain_signals'],
    properties: {
      property_details: {
        type: 'object',
        description: 'Fundamental physical and demographic stats of the property',
        properties: {
          units: { type: 'number' },
          year_built: { type: 'number' },
          management_company: { type: 'string' },
          property_type: { type: 'string' },
          class: { type: 'string', description: 'Asset class, e.g. A, B, C' },
          occupancy: { type: 'string' }
        }
      },
      isp_providers: { 
        type: 'array', 
        items: { type: 'string' }, 
        description: 'Strictly internet service providers (e.g. Gigstreem, Comcast, AT&T). DO NOT include management companies here.' 
      },
      video_providers: { 
        type: 'array', 
        items: { type: 'string' }, 
        description: 'Strictly video/TV providers (e.g. DirecTV, Spectrum).' 
      },
      bulk_agreements: {
        type: 'array',
        items: {
          type: 'object',
          required: ['provider', 'service_type', 'agreement_type', 'expiry_estimate', 'confidence', 'evidence', 'evidence_source'],
          properties: {
            provider:        { type: 'string' },
            service_type:    { type: 'string', enum: ['internet', 'video', 'bundled'] },
            agreement_type:  { type: 'string', enum: ['exclusive', 'bulk', 'preferred', 'unknown'] },
            expiry_estimate: { type: 'string' },
            confidence:      { type: 'string', enum: ['high', 'medium', 'low'] },
            evidence:        { type: 'string' },
            evidence_source: { type: 'string' },
          },
        },
      },
      extracted_contacts: {
        type: 'array',
        description: 'Decision makers (Asset Managers, Regional VPs, Property Managers) found in the text or Truth Loop.',
        items: {
          type: 'object',
          properties: { name: { type: 'string' }, title: { type: 'string' }, company: { type: 'string' }, email: { type: 'string' }, linkedin_slug: { type: 'string' } }
        }
      },
      key_finding: { type: 'string' },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      // ── Basic property facts ─────────────────────────────────────────
      units: { type: 'number', description: 'Total number of apartment units/homes. Extract from listing sites, property databases, or any source mentioning unit count.' },
      year_built: { type: 'number', description: 'Year the property was built or major renovation year.' },
      property_class: { type: 'string', enum: ['A', 'B', 'C'], description: 'Property class: A=luxury/Class A, B=mid-range, C=workforce/older.' },
      property_type: { type: 'string', description: 'e.g. multifamily, senior-living, student, mixed-use, garden-style, mid-rise, high-rise, townhome' },
      atlas_opportunity: { type: 'boolean' },
      edgar_signal: { type: 'boolean' },
      permit_signal: { type: 'boolean' },
      ownership: {
        type: 'object',
        properties: {
          owner_entity:     { type: 'string' },
          owner_type:       { type: 'string' },
          portfolio_size:   { type: 'string' },
          acquisition_year: { type: 'string' },
          capex_signal:     { type: 'string' },
          sec_filing_ref:   { type: 'string' },
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
          package_solutions:   { type: 'array', items: { type: 'string' } },
          tech_generation:     { type: 'string', enum: ['legacy','modern','hybrid'] },
          sara_signals:        { type: 'boolean' },
          replacement_window:  { type: 'string' },
          displacement_targets:{ type: 'array', items: { type: 'string' } },
        },
      },
      pain_signals: {
        type: 'array',
        description: 'Specific tenant complaints extracted from the review sentiment block (e.g. broken gates, forced wifi fees, package theft).',
        items: {
          type: 'object',
          properties: {
            source: { type: 'string' },
            date: { type: 'string' },
            signal_type: { type: 'string', enum: ['gate_access', 'internet', 'package_theft', 'intercom', 'general'] },
            quote: { type: 'string' },
            severity: { type: 'string', enum: ['high', 'medium', 'low'] }
          }
        }
      },
      behavioral_profile: {
        type: 'object',
        properties: { personality_type: { type: 'string' }, decision_style: { type: 'string' }, risk_tolerance: { type: 'string' }, communication_pref: { type: 'string' } },
      },
      pitch_strategy: {
        type: 'object',
        properties: { primary_hook: { type: 'string' }, avoid_topics: { type: 'array', items: { type: 'string' } }, best_time_to_call: { type: 'string' }, social_proof: { type: 'string' } },
      },
      freshness_score: { type: 'number' },
      buying_trends: { type: 'string' },
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
    let rawQuery: string = raw.property_name || raw.query || ''
    if (!rawQuery) return NextResponse.json({ error: 'property_name or query required' }, { status: 400 })

    // ── Query type classification: named property vs. prospecting criteria ────
    let prospectDiscoveryNote: string | undefined
    const queryClass = await classifyQuery(rawQuery, anthropic)
    if (queryClass.type === 'prospecting_query') {
      // Find specific candidate properties matching the criteria
      const candidateResults = await findCandidateProperties(
        rawQuery,
        queryClass.extracted_city,
        queryClass.extracted_state,
        queryClass.criteria_summary,
      )
      const candidateNames = await extractCandidateNames(
        candidateResults,
        rawQuery,
        queryClass.extracted_city,
        anthropic,
      )
      if (candidateNames.length > 0) {
        // Research the top candidate — swap rawQuery so the rest of the pipeline runs normally
        prospectDiscoveryNote = `Prospecting query detected. Found candidate: "${candidateNames[0]}" (from criteria: ${queryClass.criteria_summary})`
        rawQuery = candidateNames[0]
      } else {
        // No specific candidates found — fall through with original query + let Haiku try
        prospectDiscoveryNote = `Prospecting query — no specific candidates found in ${queryClass.extracted_city || 'target city'}. Searching broadly.`
      }
    }

    // ── DB lookups (run in parallel with Phase 1 discovery) ─────────────────
    let mduProviderSlugsDeep: Array<any> = []
    let mduAllProviderNames: string[] = []
    let cachedDetectionsBlockDeep = ''
    let priorFindingsBlock = ''
    let portfolioIspBlock = '' // known ISP deals at management company portfolio level

    // ── PHASE 1: Property Discovery + DB lookups in parallel ────────────────
    const [discoveryResults] = await Promise.all([
      discoverProperty(rawQuery),
      Promise.allSettled([
        (async () => {
          try {
            const { data: providers } = await supabaseDeep.from('mdu_providers').select('name, slug, property_page_pattern, operator_page_pattern, notes').eq('active', true)
            if (providers) {
              mduProviderSlugsDeep = providers.filter(p => p.property_page_pattern || p.operator_page_pattern)
              mduAllProviderNames = providers.map(p => p.name)
            }
          } catch {}
        })(),
        (async () => {
          try {
            const { data: detections } = await supabaseDeep.from('mdu_provider_detections').select('confidence, source_type, source_snippet, contract_end_year, verified_by, mdu_providers ( name, provider_type )').ilike('property_name', `%${rawQuery}%`).in('confidence', ['confirmed', 'high', 'medium']).limit(10)
            if (detections && detections.length > 0) {
              const lines = detections.map((d: any) => `• ${d.mdu_providers?.name ?? 'Unknown'}: ${d.confidence} [${d.source_type}]`)
              cachedDetectionsBlockDeep = `\n\nGATEGUARD CACHED PROVIDER DETECTIONS:\n${lines.join('\n')}\n`
            }
          } catch {}
        })(),
        (async () => {
          try {
            const { data: findings } = await supabaseDeep.from('aria_contract_findings').select('provider_name, agreement_type, service_type, expiry_year, expiry_date, confidence, source_type, source_snippet').or(`property_name.ilike.%${rawQuery}%`).in('confidence', ['confirmed', 'high', 'medium-high']).order('created_at', { ascending: false }).limit(10)
            if (findings && findings.length > 0) {
              const lines = findings.map((f: any) => `• ${f.provider_name} — ${f.agreement_type} ${f.service_type} [${f.confidence}]`)
              priorFindingsBlock = `\n\nGATEGUARD PRIOR CONTRACT FINDINGS:\n${lines.join('\n')}\n`
            }
          } catch {}
        })(),
        // Portfolio ISP knowledge base — management company level deals
        // This fires with the rawQuery mgmt hint if available, updated after Phase 2
        (async () => {
          try {
            // Pre-check using rawQuery in case mgmt co name is in the query itself
            const queryLower = rawQuery.toLowerCase()
            const knownMgmt = ['cortland','greystar','maa','nexpoint','camden','aimco','udr','invitation homes','equity residential','progress residential','starwood','landmark']
            const hintMatch = knownMgmt.find(m => queryLower.includes(m))
            if (hintMatch) {
              const { data: portfolioRows } = await supabaseDeep.from('mgmt_isp_portfolio').select('management_company_display, isp_name, agreement_type, coverage_states, coverage_notes, confidence').ilike('management_company', `%${hintMatch}%`).eq('active', true)
              if (portfolioRows && portfolioRows.length > 0) {
                const lines = portfolioRows.map((r: any) => `• ${r.management_company_display} → ${r.isp_name} (${r.agreement_type}) [${r.confidence}]\n  Coverage: ${(r.coverage_states ?? []).join(', ') || 'nationwide'}\n  ${r.coverage_notes ?? ''}`)
                portfolioIspBlock = `\n\nGATEGUARD PORTFOLIO ISP INTELLIGENCE:\n${lines.join('\n')}\n`
              }
            }
          } catch {}
        })(),
      ]),
    ])

    // ── PHASE 2: Haiku entity extraction — correct name, address, facts ──────
    const extracted = await extractPropertyFacts(discoveryResults, rawQuery, anthropic)

    // Use corrected/extracted values for all subsequent searches
    const property_name = extracted.corrected_name || rawQuery
    const address       = (raw.address as string) || extracted.address || ''
    const city          = (raw.city as string)    || extracted.city    || ''
    const state         = (raw.state as string)   || extracted.state   || ''
    const mgmt          = (raw.management_company as string) || extracted.management_company || ''
    const owner         = extracted.owner || ''
    const location      = [city, state].filter(Boolean).join(', ') || address || ''

    // Phase 2b: Now that Haiku extracted the real mgmt company name, do portfolio ISP lookup
    if (mgmt && !portfolioIspBlock) {
      try {
        const mgmtLower = mgmt.toLowerCase()
        const { data: portfolioRows } = await supabaseDeep
          .from('mgmt_isp_portfolio')
          .select('management_company_display, isp_name, agreement_type, coverage_states, coverage_notes, confidence')
          .ilike('management_company', `%${mgmtLower.split(' ')[0]}%`) // match on first word (e.g. "cortland" from "cortland partners")
          .eq('active', true)
        if (portfolioRows && portfolioRows.length > 0) {
          // Filter to relevant states if we know the state
          const relevant = state
            ? portfolioRows.filter((r: any) => !r.coverage_states?.length || r.coverage_states.includes(state.toUpperCase()))
            : portfolioRows
          if (relevant.length > 0) {
            const lines = relevant.map((r: any) => `• ${r.management_company_display} → ${r.isp_name} (${r.agreement_type}) [${r.confidence}]\n  ${r.coverage_notes ?? ''}`)
            portfolioIspBlock = `\n\nGATEGUARD PORTFOLIO ISP INTELLIGENCE (${mgmt}):\n${lines.join('\n')}\nIMPORTANT: This is GateGuard confirmed field intelligence about this management company's standard ISP deal. Use it to populate isp_providers and bulk_agreements with high confidence when property evidence is sparse.\n`
          }
        }
      } catch {}
    }

    // If we cached detections using rawQuery but now have corrected name, try again
    if (property_name !== rawQuery && !cachedDetectionsBlockDeep) {
      try {
        const { data: detections } = await supabaseDeep.from('mdu_provider_detections').select('confidence, source_type, source_snippet, contract_end_year, verified_by, mdu_providers ( name, provider_type )').ilike('property_name', `%${property_name}%`).in('confidence', ['confirmed', 'high', 'medium']).limit(10)
        if (detections && detections.length > 0) {
          const lines = detections.map((d: any) => `• ${d.mdu_providers?.name ?? 'Unknown'}: ${d.confidence} [${d.source_type}]`)
          cachedDetectionsBlockDeep = `\n\nGATEGUARD CACHED PROVIDER DETECTIONS:\n${lines.join('\n')}\n`
        }
      } catch {}
    }

    // ── PHASE 3: Targeted deep searches using corrected entities ─────────────
    const [
      ispResults, bulkResults, mgmtResults, redditResults, gateResults, proptechResults, residentTechResults,
      mgmtProptechResults, localIspResults, ownershipResults, providerSlugResultsDeep, edgarResults, pucResults,
      permitResults, ispPressResults, temporalReviewResults, vendorFootprintResults, propertyFactsResults,
      contactResults,
    ] = await Promise.all([
      // ISP confirmation — listing sites are most reliable
      tavilySearch(`"${property_name}" internet provider ISP bulk wifi "internet included" site:apartments.com OR site:rentcafe.com OR site:zillow.com OR site:apartmentratings.com`, 5, 'listing-site'),
      // Bulk internet indicators — include ISP hints from entity extraction
      tavilySearch(`"${property_name}" ${extracted.isp_hints.slice(0, 3).join(' OR ')} OR "bulk internet" OR "internet included" OR "managed wifi" OR "forced internet"`, 5, 'web'),
      // Management company MDU intel
      mgmt ? tavilySearch(`"${mgmt}" MDU internet bulk agreement exclusive OR "local ISP" OR "regional fiber" multifamily`, 5, 'web') : Promise.resolve([]),
      // Resident complaints across platforms
      tavilySearch(`"${property_name}" internet OR gate OR wifi OR "access control" OR "parking" complaint OR problem OR broken 2024 OR 2025`, 5, 'web'),
      // Proptech — gate, intercom, cameras with specific brands
      tavilySearch(`"${property_name}" ${location} gate intercom "access control" cameras security ButterflyMX OR Brivo OR DoorKing OR LiftMaster OR Aiphone OR Verkada OR Avigilon`, 5, 'web'),
      // Management co proptech standard
      mgmt ? tavilySearch(`"${mgmt}" ButterflyMX OR Brivo OR LiftMaster OR DoorKing OR SmartRent OR Latch OR Openpath OR Verkada OR "Eagle Eye" OR "Controlled Access"`, 5, 'web') : Promise.resolve([]),
      // Tech pain signals
      tavilySearch(`"${property_name}" "gate broken" OR "gate stuck" OR "intercom" OR "key fob" OR "package" OR "car break" OR "security" problem 2024 OR 2025`, 5, 'web'),
      // Management co proptech portfolio standard
      mgmt ? tavilySearch(`"${mgmt}" multifamily proptech "access control" OR "gate operator" OR "smart home" preferred vendor portfolio standard`, 4, 'web') : Promise.resolve([]),
      // Listing sites: ISP + amenities (highest confidence for bulk)
      tavilySearch(`"${property_name}" "bulk internet" OR "internet included" OR "wifi included" OR "Gigstreem" OR "SpectrumU" OR "managed wifi" site:apartments.com OR site:apartmentlist.com OR site:rent.com`, 5, 'listing-site'),
      // Ownership / acquisition / REIT
      tavilySearch(`"${property_name}" ${owner ? `OR "${owner}"` : ''} acquired ownership "asset manager" OR "portfolio" OR "REIT" OR "private equity" multifamily`, 4, 'web'),
      // Provider slug searches (per-ISP-domain)
      (async () => {
        if (!process.env.TAVILY_API_KEY || mduProviderSlugsDeep.length === 0) return []
        const slugSearches = mduProviderSlugsDeep.slice(0, 8).map((p: any) => {
          const domain = ((p.property_page_pattern || p.operator_page_pattern || '') as string).replace(/\{.*?\}/g, '').replace(/\/$/, '')
          const domainOnly = domain.replace(/^https?:\/\//, '').split('/')[0]
          if (!domainOnly) return Promise.resolve([])
          return tavilySearch(`"${property_name}" site:${domainOnly}`, 2, 'provider-slug')
        })
        const results = await Promise.allSettled(slugSearches)
        return results.filter((r): r is PromiseFulfilledResult<TavilyResult[]> => r.status === 'fulfilled').flatMap(r => r.value)
      })(),
      searchEdgar(property_name, mgmt || owner),
      searchPUC(property_name, address, state),
      searchCityPermits(address || property_name, city, state),
      searchISPPressReleases(property_name, mgmt, location),
      searchResidentReviewsTemporal(property_name, location),
      searchVendorFootprint(property_name, mgmt, location, mduAllProviderNames),
      // Property facts from listing sites using corrected name
      tavilySearch(`"${property_name}" ${location} apartment "${property_name.replace(/[^a-zA-Z0-9 ]/g, '')}" units floor plans year built amenities`, 5, 'property-facts'),
      // NEW: targeted contact search using org name
      searchContacts(mgmt, owner, city, state),
    ])

    // ── PHASE 4: Contact resolution ──────────────────────────────────────────
    const apolloContacts = mgmt ? await apolloSearchContacts(mgmt, ['Chief Executive Officer', 'CEO', 'President', 'Vice President', 'Asset Manager', 'Regional Manager', 'Regional Property Manager', 'Director', 'Portfolio Manager', 'Property Manager', 'Community Manager'], location) : []
    const validatedDMs = await proxycurlValidateDMs(apolloContacts)
    const primaryDM = validatedDMs.find(d => d.isActiveCEO && d.confidence === 'proxycurl-verified') ?? validatedDMs.find(d => d.isActiveCEO) ?? validatedDMs.find(d => !d.isFormerOrAdvisory) ?? null
    const pdlDMProfile = primaryDM ? await pdlEnrichPerson(primaryDM.name, primaryDM.company, primaryDM.email) : null

    let apolloBlock = ''
    if (validatedDMs.length > 0) {
      const activeLines = validatedDMs.filter(d => !d.isFormerOrAdvisory).map(d => `• ${d.name} — ${d.currentTitle} at ${d.company}`)
      if (activeLines.length > 0) apolloBlock = `\n\nEXECUTIVE TRUTH LOOP RESULTS:\nACTIVE DECISION MAKERS:\n${activeLines.join('\n')}\n`
    }

    const tavilyAll = [
      ...ispResults, ...bulkResults, ...mgmtResults, ...redditResults, ...gateResults, ...proptechResults, ...residentTechResults,
      ...mgmtProptechResults, ...localIspResults, ...ownershipResults, ...(Array.isArray(providerSlugResultsDeep) ? providerSlugResultsDeep : []),
      ...pucResults, ...permitResults, ...ispPressResults, ...temporalReviewResults, ...vendorFootprintResults,
      ...(Array.isArray(propertyFactsResults) ? propertyFactsResults : []),
      ...(Array.isArray(contactResults) ? contactResults : []),
      ...discoveryResults,
    ]

    const edgarAsResults: TavilyResult[] = edgarResults.map(e => ({ title: e.title, url: e.url, content: `[SEC EDGAR — PRIMARY SOURCE] ${e.content}`, score: e.score, source: e.source }))
    const allResults = [...edgarAsResults, ...tavilyAll]

    const seenUrls = new Set<string>()
    const deepBoostSources: Record<string, number> = {
      'vendor-footprint': 0.45, 'provider-slug': 0.40,
      'EDGAR': 0.30, 'PUC': 0.30, 'CityPermit': 0.30,
      'ISP-Press': 0.25, 'resident-review': 0.20,
    }
    const uniqueResults = allResults
      .filter(r => { if (seenUrls.has(r.url)) return false; seenUrls.add(r.url); return r.score > 0.25 })
      .sort((a, b) => (b.score + (deepBoostSources[b.source ?? ''] ?? 0)) - (a.score + (deepBoostSources[a.source ?? ''] ?? 0)))
      .slice(0, 22)

    if (uniqueResults.length === 0) {
      return NextResponse.json({ error: 'No data found.' }, { status: 404 })
    }

    const reviewSnippets = uniqueResults.filter(r => r.source === 'resident-review' || (r.source === 'web' && (r.url.includes('apartmentratings') || r.url.includes('reddit'))))
    const reviewSentimentBlock = await extractReviewSentiment(reviewSnippets, anthropic)

    // Build source summary for user prompt context
    const sourcesSummary = [
      edgarResults.length > 0    ? `[EDGAR: ${edgarResults.length} SEC filing(s)]` : null,
      pucResults.length > 0      ? `[PUC: ${pucResults.length} utility filing(s)]` : null,
      permitResults.length > 0   ? `[CityPermit: ${permitResults.length} permit(s)]` : null,
      ispPressResults.length > 0 ? `[ISP-Press: ${ispPressResults.length} press result(s)]` : null,
      vendorFootprintResults.length > 0 ? `[VENDOR-FOOTPRINT: ${vendorFootprintResults.length} vendor listing(s)]` : null,
      temporalReviewResults.length > 0  ? `[RESIDENT-REVIEWS: ${temporalReviewResults.length} review(s)]` : null,
      apolloContacts.length > 0         ? `[APOLLO: ${apolloContacts.length} contact(s)]` : null,
      validatedDMs.length > 0           ? `[PROXYCURL-VERIFIED: ${validatedDMs.length} DM(s) validated]` : null,
    ].filter(Boolean).join(' | ')

    const excerptBlock = uniqueResults.map((r, i) => `[Source ${i + 1}] [${r.source?.toUpperCase()}] ${r.title}\nURL: ${r.url}\n${r.content.slice(0, 500)}`).join('\n\n---\n\n')

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      tools: [deepIntelTool],
      tool_choice: { type: 'tool', name: 'aria_deep_intel_result' },
      system: `You are ARIA's elite PropTech OSINT intelligence module. Extract ALL available details into the tool schema. Your job is precise data extraction — never hallucinate.

CRITICAL — always populate these fields when any evidence exists:
• property_details.units: total apartment/home count — look for "X units", "X homes", "X-unit community", "X apartment homes". Never leave null if any source mentions unit count.
• property_details.year_built: construction or major renovation year
• property_details.class: A/B/C based on amenities, rent tier, and age
• property_details.property_type: multifamily / senior-living / student / mixed-use / garden-style / mid-rise / high-rise
• isp_providers, video_providers, bulk_agreements: any internet/video provider mentioned
• proptech fields: any gate, intercom, access control, camera, lock brand found
• ownership.owner_entity: REIT, PE firm, or private owner name
• pain_signals: concrete resident complaints about gates, internet, packages
• extracted_contacts: any human names, emails, or LinkedIn URLs found in text associated with regional/asset/property management

SOURCE HIERARCHY — trust these in order:
1. [EDGAR] SEC filings — PRIMARY SOURCE. REITs disclose material bulk service agreements by name. Highest confidence.
2. [PUC] State Public Utility Commission filings — ISP ROW/conduit applications confirm physical presence. High confidence.
3. [CITYPERMIT] City permit records — ISP fiber/conduit permits confirm infrastructure installation. High confidence.
4. [ISP-PRESS] ISP press releases / partner portal announcements — ISPs announce MDU wins. Medium-high confidence.
5. [VENDOR-FOOTPRINT] ISP/vendor's own website listing this property — treat as CONFIRMED (override all other sources).
6. [LISTING-SITE] Apartment listing amenity descriptions — "Internet by X" is reliable. Medium-high confidence.
7. [WEB] General web content — Reddit, reviews, news. Medium confidence.

BULK AGREEMENT EXTRACTION — CRITICAL ACCURACY RULES:
⚠ NEVER guess the bulk provider based on which ISP is largest or most well-known in an area.
⚠ Local/regional ISPs (Gigstreem, Sonic, Hotwire, WideOpenWest, Vyve, IgLou, Pavlov, etc.) frequently have MDU deals — trust them over national carrier assumptions.
⚠ If any source names a small/unfamiliar ISP as the building's provider, TRUST IT over a national carrier.
⚠ Return bulk_agreements = [] if no property-specific evidence exists. Never infer from market patterns.
Confidence rules: high=EDGAR/PUC/permit confirms OR explicit "internet included"; medium=listing site/ISP press implies; low=inferred from patterns

CRITICAL ENTITY RESOLUTION RULES:
1. NEVER confuse a Management Company or Owner (e.g. Northland, Greystar, Starwood) with an Internet Service Provider. "Northland Internet" is a hallucination — if managed by Northland and uses Gigstreem, the ISP is Gigstreem, full stop.
2. DirecTV, DISH, Spectrum video → record as video_provider AND bulk_agreement with service_type "video".
3. If a listing says "gated community", "controlled access", or "callbox" with no brand, put "Unknown (gated)" in proptech.access_control. Named brands (DoorKing, ButterflyMX, Brivo) always override.
4. isp_providers must contain only actual ISPs. Management company names never belong here.

OWNERSHIP ANALYSIS: EDGAR is the gold standard for REIT ownership. Populate sec_filing_ref if EDGAR confirmed.
key_finding: "[WHO to call] at [company] controls capex. [WHY NOW: deal expiry, acquisition, aging tech, SEC signal]."

BEHAVIORAL PROFILE: analytical (PE/REIT, CFOs), driver (Regional VPs), expressive (Marketing PMs), amiable (Community managers)
PITCH STRATEGY: primary_hook = single opening sentence referencing THIS property's specific pain.

FRESHNESS SCORE (1–5): 5=SEC 8-K in 90d or contract expiry this year; 4=resident complaints 6mo or ISP press 1yr; 3=listing confirmed or EDGAR 10-K 2yr; 2=older web data; 1=all inference
edgar_signal: true if ANY EDGAR source was useful. permit_signal: true if ANY city permit/PUC confirms ISP infrastructure.`,
      messages: [{
        role: 'user',
        content: `Property: ${property_name}\nAddress: ${address || extracted.address || 'unknown'}\nLocation: ${location}\nManagement Company: ${mgmt || 'unknown'}\nOwner: ${owner || 'unknown'}\nPre-extracted facts (Haiku Phase 1): units=${extracted.units ?? 'unknown'}, year_built=${extracted.year_built ?? 'unknown'}, class=${extracted.property_class ?? 'unknown'}, ISP hints=[${extracted.isp_hints.join(', ')}]\nSources retrieved: ${sourcesSummary || 'web only'}\n${portfolioIspBlock}${priorFindingsBlock}${cachedDetectionsBlockDeep}${apolloBlock}${reviewSentimentBlock}
CRITICAL REMINDERS:
- Pre-extracted facts above were pulled from listing sites — use them as confirmed baseline. Do NOT ignore them.
- [VENDOR-FOOTPRINT] source = the ISP/vendor's OWN website listing this property — treat as CONFIRMED.
- [LISTING-SITE] and [DISCOVERY] sources have address, units, year_built — use them directly in property_details.
- [EDGAR] SEC filings = primary source for ownership and bulk deals.
- Return bulk_agreements = [] if no property-specific evidence exists. Never infer from market patterns.
- Prioritize local/regional ISP names (Gigstreem, Hotwire, Pavlov, WOW, Vyve, etc.) over national carrier assumptions.
- CONTACT SEARCH results ([contact-search] source) contain actual people names, titles, LinkedIn slugs — extract ALL of them into extracted_contacts.
- EXECUTIVE TRUTH LOOP: Use the verified DM list. Any contact tagged [FORMER/ADVISORY] must NOT be recommended as primary contact.

Intelligence excerpts:\n${excerptBlock}`
      }],
    })

    const toolBlock = message.content.find(b => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined
    if (!toolBlock) throw new Error('No synthesis result from Claude')

    // ── Source metadata for response ─────────────────────────────────────────
    const sources = uniqueResults.slice(0, 8).map(r => ({
      title: r.title,
      url: r.url,
      excerpt: r.content.slice(0, 200),
      score: r.score,
      type: r.source ?? 'web',
    }))

    const intelligenceSources = {
      edgar:              edgarResults.length > 0,
      puc:                pucResults.length > 0,
      permits:            permitResults.length > 0,
      isp_press:          ispPressResults.length > 0,
      listing_sites:      localIspResults.some((r: TavilyResult) => r.score > 0.4),
      vendor_footprint:   vendorFootprintResults.length > 0,
      resident_reviews:   temporalReviewResults.length > 0,
      apollo:             apolloContacts.length > 0,
      proxycurl_verified: validatedDMs.some(d => d.confidence === 'proxycurl-verified'),
      pdl:                pdlDMProfile !== null,
      dm_verified_count:  validatedDMs.filter(d => !d.isFormerOrAdvisory).length,
      portfolio_isp_match: portfolioIspBlock.length > 0, // GateGuard confirmed mgmt-co ISP deal
    }

    // ── THE CRITICAL SANITIZATION LAYER ──────────────────────────────────────
    const rawData = toolBlock.input as Record<string, any>;
    
    // Combine API contacts (ProxyCurl) with AI-extracted web contacts
    const webContact = rawData.extracted_contacts?.[0] || {};
    const primaryContactName = validatedDMs[0]?.name || webContact.name || rawData.ownership?.asset_manager?.name || mgmt || property_name;

    // Force payload into the exact shape expected by the DB and UI
    const prospectPayload = {
      property: {
        name: property_name,
        // Use extracted address (Phase 1 Haiku) if Sonnet didn't find it
        address: address || extracted.address || location || property_name,
        // Extracted facts as authoritative fallbacks — never show Unknown if Haiku found it
        units: rawData.property_details?.units ?? rawData.units ?? extracted.units ?? null,
        property_type: rawData.property_details?.property_type ?? rawData.property_type ?? 'multifamily',
        class: rawData.property_details?.class ?? rawData.property_class ?? extracted.property_class ?? null,
        year_built: rawData.property_details?.year_built ?? rawData.year_built ?? extracted.year_built ?? null,
        management_company: (rawData.property_details?.management_company ?? mgmt ?? extracted.management_company) || 'Unknown',
        owner_entity: rawData.ownership?.owner_entity ?? owner ?? 'Unknown',
        isp_providers: rawData.isp_providers ?? [],
        video_providers: rawData.video_providers ?? [],
        bulk_agreements: rawData.bulk_agreements ?? [],
        _fcc_verified: edgarResults.length > 0 || permitResults.length > 0,
        proptech: {
          gate_operators: rawData.proptech?.gate_operators ?? [],
          access_control: rawData.proptech?.access_control ?? [],
          intercoms: rawData.proptech?.intercoms ?? [],
          cameras: rawData.proptech?.cameras ?? [],
          smart_locks: rawData.proptech?.smart_locks ?? [],
          resident_apps: rawData.proptech?.resident_apps ?? [],
          package_solutions: rawData.proptech?.package_solutions ?? [],
          tech_generation: rawData.proptech?.tech_generation ?? 'legacy',
          sara_signals: rawData.proptech?.sara_signals ?? false,
          replacement_window: rawData.proptech?.replacement_window ?? null,
          displacement_targets: rawData.proptech?.displacement_targets ?? []
        }
      },
      decision_maker: {
        name: primaryContactName,
        title: validatedDMs[0]?.currentTitle || webContact.title || 'Executive',
        company: validatedDMs[0]?.company || webContact.company || mgmt,
        email: validatedDMs[0]?.email || webContact.email || '',
        phone: '',
        tenure_years: 0,
        top_email_format: '',
        linkedin_slug: validatedDMs[0]?.linkedinUrl?.split('/in/')?.[1] || webContact.linkedin_slug || ''
      },
      decision_maker_chain: validatedDMs.length > 0 
        ? validatedDMs.map(dm => ({
            name: dm.name,
            title: dm.currentTitle,
            company: dm.company,
            role_type: dm.isActiveCEO ? 'owner' : 'asset_manager',
            email: dm.email || '',
            top_email_format: '',
            linkedin_slug: dm.linkedinUrl?.split('/in/')?.[1] || ''
          }))
        : (rawData.extracted_contacts || []).map((wc: any) => ({
            name: wc.name,
            title: wc.title,
            company: wc.company,
            role_type: 'unknown',
            email: wc.email || '',
            top_email_format: '',
            linkedin_slug: wc.linkedin_slug || ''
        })),
      ownership: rawData.ownership ? {
        owner_entity: rawData.ownership.owner_entity ?? null,
        owner_type: rawData.ownership.owner_type ?? null,
        portfolio_size: rawData.ownership.portfolio_size ?? null,
        acquisition_year: rawData.ownership.acquisition_year ?? null,
        capex_signal: rawData.ownership.capex_signal ?? null,
      } : null,
      pain_signals: rawData.pain_signals ?? [],
      profile: {
        buy_score: rawData.freshness_score ? Math.round(rawData.freshness_score * 1.5 + 2) : 5,
        urgency: (rawData.bulk_agreements ?? []).length > 0 || (rawData.pain_signals ?? []).length > 0 ? 'high' : 'medium',
        primary_concern: rawData.key_finding?.slice(0, 80) ?? 'No critical vulnerabilities detected',
        current_vendor: (rawData.bulk_agreements?.[0] as any)?.provider ?? 'Unknown',
        contract_window: (rawData.bulk_agreements?.[0] as any)?.expiry_estimate ?? 'Unknown',
        communication_style: rawData.behavioral_profile?.communication_pref ?? 'Email',
      },
      scout_brief: {
        primary_contact: primaryContactName,
        outreach_angle: rawData.atlas_opportunity ? 'contract_window' : 'tech_displacement',
        contract_window_urgency: 'medium',
        key_data_points: rawData.key_finding ? [rawData.key_finding] : [],
      },
    }

    // ── Save to aria_searches (Recent Memory + savedSearchId) ────────────────
    let savedSearchId: string | undefined;
    try {
      const portalUser = await getCurrentUser();
      // originalQuery = what the user actually typed before any correction/candidate resolution
      const originalQuery = raw.property_name || raw.query || rawQuery
      const { data: searchRow } = await supabaseDeep
        .from('aria_searches')
        .insert({
          query: originalQuery, // store what the user typed; corrected name is in the results
          query_interpretation: prospectDiscoveryNote ?? (property_name !== originalQuery ? `Searched as: ${property_name}` : 'ARIA Deep Intel'),
          results: { mode: 'deep', prospects: [prospectPayload], fccVerified: edgarResults.length > 0 || permitResults.length > 0, webIntelligence: true },
          search_type: 'deep',
          user_id: userId,
          user_name: portalUser.name,
          user_email: portalUser.email,
          org_id: portalUser.org_id ?? null,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        })
        .select('id')
        .single();
      if (searchRow?.id) savedSearchId = searchRow.id;
    } catch { /* best-effort — don't block the response */ }

    // ── Persist mdu_provider_detections (non-blocking) ──────────────────────
    const bulkAgreementsForDetection: any[] = rawData.bulk_agreements ?? []
    if (bulkAgreementsForDetection.length > 0) {
      void (async () => {
        try {
          const { data: allProviders } = await supabaseDeep
            .from('mdu_providers')
            .select('id, name')
            .eq('active', true)
          if (!allProviders) return
          const rows = bulkAgreementsForDetection
            .filter((a: any) => ['high', 'confirmed', 'medium'].includes(a.confidence ?? ''))
            .map((a: any) => {
              const provName = (a.provider ?? '').toLowerCase()
              const matched = (allProviders as any[]).find(
                p => p.name.toLowerCase().includes(provName) || provName.includes(p.name.toLowerCase())
              )
              if (!matched) return null
              const yearMatch = (a.expiry_estimate ?? '').match(/20\d{2}/)
              return {
                provider_id: matched.id,
                property_name: property_name || null,
                property_address: address || null,
                confidence: a.confidence === 'confirmed' ? 'confirmed' : (a.confidence === 'high' ? 'high' : 'medium'),
                source_type: a.evidence_source ?? 'aria',
                source_snippet: a.evidence ? (a.evidence as string).slice(0, 250) : null,
                contract_end_year: yearMatch ? parseInt(yearMatch[0], 10) : null,
                verified_by: 'aria',
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

    // ── Persist to Intel DB (non-blocking) ───────────────────────────────────
    void (async () => {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/aria/properties`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prospects: [prospectPayload] }),
        })
      } catch { /* non-blocking */ }
    })()

    // Return exact format UI expects
    return NextResponse.json({
      mode: "deep",
      query_interpretation: prospectDiscoveryNote ?? "ARIA Deep OSINT Aggregation",
      prospects: [prospectPayload],
      savedSearchId,
      sources,
      intelligence_sources: intelligenceSources,
      fccVerified: edgarResults.length > 0 || permitResults.length > 0,
      webIntelligence: true,
      ...(prospectDiscoveryNote ? { prospect_discovery_note: prospectDiscoveryNote } : {}),
    })

  } catch (err: any) {
    console.error('[aria/research/deep]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
