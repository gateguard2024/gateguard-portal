/**
 * POST /api/aria/research/deep
 *
 * ARIA Sales Intelligence Engine v7.0 — Sequential Informed Phase Architecture
 *
 * Phase 0  — Query Classification (~0.5s)        | 1 Haiku call
 * Phase 1A — Specific Property: Listing Sites    | 2 parallel searches + 1 Haiku
 * Phase 1B — Prospecting Candidate List          | 2-3 parallel searches + 1 Haiku
 * Phase 2  — Enrichment (~5s, parallel)          | FCC + 2 targeted searches + 1 Haiku
 * Phase 3  — Intelligence (~7s, parallel)        | 3 searches + Apollo + NinjaPear + emailFormat
 * Phase 4  — Synthesis (~9s)                     | Claude Sonnet tool-use
 *
 * Total: ~26-30s for specific_property | ~7-10s for candidate list
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabaseDeep = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const maxDuration = 120
export const dynamic = 'force-dynamic'

const ARIA_ENGINE_VERSION = 'v7.2'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ─── Normalization helpers ────────────────────────────────────────────────────

const SENTINEL_STRINGS = new Set(['null','undefined','unknown','n/a','na','none','not found','not available','','—','–','-','0','tbd','?'])

function normStr(val: unknown): string | null {
  if (val === null || val === undefined) return null
  const s = String(val).trim()
  if (/^<[^>]{0,30}>$/.test(s)) return null
  return SENTINEL_STRINGS.has(s.toLowerCase()) ? null : s
}
function normInt(val: unknown): number | null {
  if (val === null || val === undefined) return null
  if (typeof val === 'number') return val > 0 ? val : null
  const n = parseInt(String(val).replace(/[^0-9]/g, ''), 10)
  return isNaN(n) || n <= 0 ? null : n
}
function normStrArr(arr: unknown): string[] {
  if (!Array.isArray(arr)) return []
  return arr.map(v => normStr(v)).filter((v): v is string => v !== null)
}

// ─── Tavily ───────────────────────────────────────────────────────────────────

interface TavilyResult { title: string; url: string; content: string; raw_content?: string; score: number; source?: string }

async function tavilySearch(
  query: string,
  maxResults = 4,
  source = 'web',
  depth: 'basic' | 'advanced' = 'basic',
  rawContent = false
): Promise<TavilyResult[]> {
  if (!process.env.TAVILY_API_KEY) return []
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.TAVILY_API_KEY}` },
      body: JSON.stringify({
        query, search_depth: depth, max_results: maxResults,
        include_answer: false, include_raw_content: rawContent, include_images: false,
      }),
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.results ?? []).map((r: TavilyResult) => ({ ...r, source }))
  } catch { return [] }
}

// ─── Serper (Google Search API) ──────────────────────────────────────────────

async function serperSearch(
  query: string,
  maxResults = 5,
  source = 'serper',
  type: 'search' | 'news' = 'search'
): Promise<TavilyResult[]> {
  if (!process.env.SERPER_API_KEY) return []
  try {
    const endpoint = type === 'news' ? 'https://google.serper.dev/news' : 'https://google.serper.dev/search'
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': process.env.SERPER_API_KEY },
      body: JSON.stringify({ q: query, num: maxResults, gl: 'us', hl: 'en' }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return []
    const data = await res.json()
    const items = type === 'news' ? (data.news ?? []) : (data.organic ?? [])
    return items.slice(0, maxResults).map((r: any) => ({
      title: r.title ?? '',
      url: r.link ?? '',
      content: [r.snippet, r.date].filter(Boolean).join(' — '),
      score: 0.8,
      source,
    }))
  } catch { return [] }
}

// ─── Haiku JSON extraction helper ─────────────────────────────────────────────

async function haikusExtract<T>(prompt: string, snippets: string, maxTokens: number, client: Anthropic): Promise<T | null> {
  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: `${prompt}\n\nSEARCH RESULTS:\n${snippets}` }],
    })
    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : '{}'
    const match = text.match(/\{[\s\S]+\}/)
    if (match) return JSON.parse(match[0]) as T
  } catch { }
  return null
}

// ─── Nominatim geocoding (free) ───────────────────────────────────────────────

async function geocodeAddress(address: string, city: string, state: string): Promise<{ lat: number; lng: number } | null> {
  const query = [address, city, state].filter(Boolean).join(', ')
  if (!query) return null
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'GateGuard-ARIA/7.0 (rfeldman@gateguard.co)' }, signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.[0]) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch { return null }
}

// ─── FCC Broadband Map API (free) ─────────────────────────────────────────────

async function fccBroadbandLookup(lat: number, lng: number): Promise<string[]> {
  try {
    const res = await fetch(
      'https://broadbandmap.fcc.gov/api/public/map/listAvailability',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'GateGuard-ARIA/7.0' },
        body: JSON.stringify({
          latitude: parseFloat(lat.toFixed(6)),
          longitude: parseFloat(lng.toFixed(6)),
          unit: 'location',
          limit_to_isp: 'N',
        }),
        signal: AbortSignal.timeout(6000),
      }
    )
    if (!res.ok) return []
    const data = await res.json()
    const providers: Array<{ brand_name: string; technology: string }> = data?.results ?? data?.availability ?? data?.data ?? []
    return [...new Set(
      providers
        .filter(p => p.technology && !['60','70','300','400'].includes(String(p.technology)))
        .map(p => p.brand_name)
        .filter(Boolean)
    )]
  } catch { return [] }
}

// ─── Apollo People Enrichment ─────────────────────────────────────────────────

interface ApolloEnrichment {
  name?: string; title?: string; email?: string;
  phone_numbers?: string[]; linkedin_url?: string;
  organization?: { name?: string }
}

async function apolloEnrichPerson(name: string, domain: string): Promise<ApolloEnrichment | null> {
  if (!process.env.APOLLO_API_KEY) return null
  try {
    const res = await fetch('https://api.apollo.io/api/v1/people/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.APOLLO_API_KEY}` },
      body: JSON.stringify({ name, domain, reveal_personal_emails: true }),
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const p = data?.person
    if (!p) return null
    return { name: p.name, title: p.title, email: p.email, phone_numbers: p.phone_numbers, linkedin_url: p.linkedin_url, organization: p.organization }
  } catch { return null }
}

// ─── NinjaPear Employee API ───────────────────────────────────────────────────

interface NinjaPearProfile {
  full_name?: string
  first_name?: string
  last_name?: string
  work_experience?: Array<{ role?: string; company_name?: string; company_website?: string; start_date?: string; end_date?: string | null }>
}

async function ninjapearValidatePerson(firstName: string, lastName: string, employerWebsite: string): Promise<NinjaPearProfile | null> {
  if (!process.env.NINJAPEAR_API_KEY) return null
  try {
    const params = new URLSearchParams({ first_name: firstName, last_name: lastName, employer_website: employerWebsite })
    const res = await fetch(`https://nubela.co/api/v1/employee/profile?${params}`, {
      headers: { Authorization: `Bearer ${process.env.NINJAPEAR_API_KEY}` },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

// ─── Management company domain lookup ────────────────────────────────────────

const MGMT_DOMAIN_MAP: Record<string, string> = {
  'greystar': 'greystar.com',
  'lincoln property': 'lincolnapts.com',
  'cushman': 'cushwake.com',
  'equity residential': 'equityapartments.com',
  'camden': 'camdenliving.com',
  'aimco': 'aimco.com',
  'udr': 'udr.com',
  'essex': 'essexapartmenthomes.com',
  'avalonbay': 'avalonbay.com',
  'bozzuto': 'bozzuto.com',
  'morgan properties': 'morganproperties.com',
  'cortland': 'cortland.com',
  'northland': 'northlandco.com',
  'alliance residential': 'allresco.com',
  'bell partners': 'bellpartnersinc.com',
  'fairfield': 'fairfieldresidential.com',
  'weidner': 'weidner.com',
  'related': 'related.com',
  'bridge property': 'bridgepm.com',
  'peak living': 'peakliving.com',
  'cardinal group': 'cardinalgroup.com',
  'harbor group': 'harborgroupintl.com',
  'maa': 'maac.com',
  'mid-america': 'maac.com',
  'village green': 'villagegreen.com',
  'kettler': 'kettler.net',
}

function deriveMgmtDomain(name: string): string {
  if (!name) return ''
  const lower = name.toLowerCase()
  for (const [key, domain] of Object.entries(MGMT_DOMAIN_MAP)) {
    if (lower.includes(key)) return domain
  }
  return ''
}

// ─── Email construction helper ───────────────────────────────────────────────

function constructEmail(firstName: string, lastName: string, domain: string, format: string): string {
  if (!firstName || !lastName || !domain) return ''
  const f = firstName.toLowerCase().trim()
  const l = lastName.toLowerCase().trim()
  const fi = f[0]
  if (!format) return `${f}.${l}@${domain}`
  if (format.includes('first.last') || format.includes('firstname.lastname')) return `${f}.${l}@${domain}`
  if (format.includes('flastname') || format.includes('firstlast') || format.includes('f.last')) return `${fi}${l}@${domain}`
  if (format.includes('firstname') && !format.includes('.')) return `${f}@${domain}`
  if (format.includes('first_last')) return `${f}_${l}@${domain}`
  return `${f}.${l}@${domain}`
}

// ─── DB lookback: pre-seed from existing intel ───────────────────────────────

interface AriaDbRecord {
  id?: string
  property_name?: string; address?: string; units?: number; year_built?: number
  management_company?: string; owner_entity?: string; website?: string; phone?: string
  isp_providers?: string[]; video_providers?: string[]
  bulk_agreements?: any[]; roe_detected?: boolean; roe_providers?: string[]; roe_expiry_year?: number
  isp_providers_user_verified?: boolean; video_providers_user_verified?: boolean
  roe_expiry_user_verified?: boolean; dm_name_user_verified?: boolean
  dm_email_user_verified?: boolean; dm_phone_user_verified?: boolean
  dm_name?: string; dm_email?: string; dm_phone?: string; dm_title?: string
  dm_linkedin_slug?: string; dm_chain?: any[]
  times_researched?: number
}

async function lookupExistingProperty(query: string, cityHint: string | null): Promise<AriaDbRecord | null> {
  try {
    // Build multiple search patterns to handle "northland warf 7" → DB "Wharf 7"
    // The AI-confirmed name (stored in DB) may differ from the search query
    const COMMON_MGMT_WORDS = new Set(['investment','corporation','corp','inc','llc','management','property','properties','residential','realty','greystar','northland','cortland','lincoln','bozzuto','camden'])
    const words = query.trim().split(/\s+/)

    // Pattern 1: last 2 words — often the actual property name ("warf 7", "wharf 7")
    const lastTwo = words.slice(-2).join(' ')
    // Pattern 2: skip first word if it looks like a mgmt company keyword
    const skipFirst = COMMON_MGMT_WORDS.has(words[0]?.toLowerCase()) ? words.slice(1).join(' ') : query
    // Pattern 3: full query stripped of state/city suffixes
    const fullNorm = query.replace(/,?\s+(atlanta|austin|dallas|houston|chicago|phoenix|denver|nashville|miami|charlotte|raleigh|seattle|boston|NYC|new york|los angeles|san francisco|[A-Z]{2})$/i, '').trim()

    const patterns = [...new Set([lastTwo, skipFirst, fullNorm].filter(p => p.length >= 3))]

    const cols = 'id,property_name,address,units,year_built,management_company,owner_entity,isp_providers,video_providers,bulk_agreements,roe_detected,roe_providers,roe_expiry_year,isp_providers_user_verified,video_providers_user_verified,roe_expiry_user_verified,dm_name,dm_email,dm_phone,dm_title,dm_linkedin_slug,dm_chain,dm_name_user_verified,dm_email_user_verified,dm_phone_user_verified,times_researched'

    for (const pattern of patterns) {
      let q = supabaseDeep
        .from('aria_properties')
        .select(cols)
        .ilike('property_name', `%${pattern}%`)
      if (cityHint) q = q.ilike('address', `%${cityHint}%`)
      const { data } = await q.limit(1).maybeSingle()
      if (data) return data as AriaDbRecord
    }

    // Fallback: city-only search if city hint provided
    if (cityHint && words.length >= 2) {
      const { data } = await supabaseDeep
        .from('aria_properties')
        .select(cols)
        .ilike('address', `%${cityHint}%`)
        .ilike('property_name', `%${words[words.length - 1]}%`)
        .limit(1)
        .maybeSingle()
      if (data) return data as AriaDbRecord
    }

    return null
  } catch { return null }
}

// ─── PHASE 0: Query Classification ────────────────────────────────────────────

type QueryType = 'specific_property' | 'city_prospect' | 'criteria_prospect' | 'contract_prospect'

interface QueryClassification {
  type: QueryType
  normalized_query: string
  city_hint: string | null
  state_hint: string | null
  mgmt_hint: string | null
  size_hint: string | null
}

async function classifyQuery(query: string, client: Anthropic): Promise<QueryClassification> {
  const fallback: QueryClassification = {
    type: 'specific_property',
    normalized_query: query,
    city_hint: null, state_hint: null, mgmt_hint: null, size_hint: null,
  }

  const extracted = await haikusExtract<QueryClassification>(
    `Classify this real estate sales intelligence query. Return ONLY valid JSON:
{"type":"specific_property","normalized_query":"","city_hint":null,"state_hint":null,"mgmt_hint":null,"size_hint":null}

QUERY: "${query}"

CLASSIFICATION RULES:
- "specific_property" → user named a specific property/community (e.g. "Northland Wharf 7", "The Flats at Midtown", "1234 Main St Atlanta")
- "city_prospect" → looking for properties in a city/area (e.g. "multifamily in Atlanta with gate complaints", "Phoenix apartments")
- "criteria_prospect" → property type/size criteria (e.g. "HOA 500+ units with gates in Ohio", "Class A multifamily")
- "contract_prospect" → bulk agreement timing focus (e.g. "bulk agreements expiring 2026", "MDU contracts ending soon")

Extract any hints:
- normalized_query: cleaned version of the query (strip filler words)
- city_hint: city name if mentioned, else null
- state_hint: 2-letter state code if mentioned, else null
- mgmt_hint: management company name if mentioned (Greystar, Lincoln, etc.), else null
- size_hint: unit count threshold if mentioned (e.g. "500+", "300-500"), else null`,
    '', 300, client
  )

  if (!extracted) return fallback
  return {
    type: (['specific_property', 'city_prospect', 'criteria_prospect', 'contract_prospect'].includes(extracted.type) ? extracted.type : 'specific_property') as QueryType,
    normalized_query: normStr(extracted.normalized_query) || query,
    city_hint: normStr(extracted.city_hint),
    state_hint: normStr(extracted.state_hint),
    mgmt_hint: normStr(extracted.mgmt_hint),
    size_hint: normStr(extracted.size_hint),
  }
}

// ─── PHASE 1A: Specific Property — Listing Sites First ──────────────────────

interface Phase1Result {
  confirmed_name: string | null
  confirmed_address: string | null
  confirmed_city: string | null
  confirmed_state: string | null
  confirmed_units: number | null
  confirmed_year_built: number | null
  confirmed_management: string | null
  confirmed_owner: string | null
  confirmed_website: string | null
  confirmed_phone: string | null
  is_specific_property: boolean
  // Amenity-sourced fields — directly from listing page full content
  listing_url: string | null
  listing_isp: string | null           // e.g. "GIGstreem" — from amenities section
  listing_cable: string | null         // e.g. "DirecTV" — from amenities section
  listing_proptech: string[]           // e.g. ["ButterflyMX","Brivo"] — from amenities
  listing_bulk_detected: boolean       // "internet included" or "tech fee" on listing
}

async function runPhase1A(query: string, client: Anthropic): Promise<Phase1Result> {
  const blank: Phase1Result = {
    confirmed_name: null, confirmed_address: null, confirmed_city: null, confirmed_state: null,
    confirmed_units: null, confirmed_year_built: null,
    confirmed_management: null, confirmed_owner: null,
    confirmed_website: null, confirmed_phone: null,
    is_specific_property: false,
    listing_url: null, listing_isp: null, listing_cable: null,
    listing_proptech: [], listing_bulk_detected: false,
  }

  // Three parallel searches:
  // 1. Listing sites — snippet only (fast identity confirmation)
  // 2. Press/news — unit count, year built
  // 3. Amenities deep-read — raw full-page content to catch ISP/cable/gate in amenities section
  const [listingResults, pressResults, amenityResults] = await Promise.all([
    tavilySearch(
      `"${query}" apartments site:apartments.com OR site:rentcafe.com OR site:zillow.com OR site:apartmentlist.com`,
      4, 'listing', 'advanced', false
    ),
    serperSearch(
      `"${query}" apartments "apartment homes" OR units completed OR opened OR built`,
      5, 'press', 'news'
    ),
    // Raw content fetch — amenities sections explicitly list ISP/cable/gate providers
    tavilySearch(
      `"${query}" apartments amenities internet cable intercom gate access`,
      2, 'amenities', 'advanced', true  // rawContent = TRUE — reads the full page
    ),
  ])

  const allResults = [...listingResults, ...pressResults]
  if (allResults.length === 0 && amenityResults.length === 0) return blank

  // Standard identity snippets — 900 chars (was 600, bumped to catch unit counts that appear mid-listing)
  const snippets = allResults
    .filter(r => (r.content || '').length > 30)
    .slice(0, 10)
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content.slice(0, 900)}`)
    .join('\n\n---\n\n')

  // Amenity raw content — first 4000 chars of each page (amenities usually near top)
  const amenitySnippets = amenityResults
    .filter(r => r.raw_content && r.raw_content.length > 100)
    .slice(0, 2)
    .map((r, i) => `[A${i + 1}] URL: ${r.url}\n${(r.raw_content ?? r.content).slice(0, 4000)}`)
    .join('\n\n---\n\n')

  const combinedSnippets = [snippets, amenitySnippets].filter(Boolean).join('\n\n===AMENITY PAGES===\n\n')
  if (!combinedSnippets) return blank

  const extracted = await haikusExtract<Phase1Result>(
    `Extract verified property facts AND amenity/technology data. Return ONLY valid JSON:
{"confirmed_name":null,"confirmed_address":null,"confirmed_city":null,"confirmed_state":null,"confirmed_units":null,"confirmed_year_built":null,"confirmed_management":null,"confirmed_owner":null,"confirmed_website":null,"confirmed_phone":null,"is_specific_property":false,"listing_url":null,"listing_isp":null,"listing_cable":null,"listing_proptech":[],"listing_bulk_detected":false}

IDENTITY RULES:
- confirmed_name: exact community name found in results (not the query — the real name)
- confirmed_address: full street address if found
- confirmed_city + confirmed_state: REQUIRED if any geo context exists
- confirmed_units: LOOK HARD — patterns: "312 units", "312-unit", "Total Units: 312", "N studio to", "312 apartments", "312 homes", "312 available", "Showing X of 312", "312 floor plans", "312 residences", "312 apartment homes". Even if you see only "studio - 3 bed" floor plans listed, count the distinct plans as a minimum.
- confirmed_year_built: from "built YYYY", "Year Built: YYYY", "opened YYYY", "completed YYYY", "constructed YYYY", "established YYYY"
- confirmed_management: company managing day-to-day operations
- confirmed_owner: investor/developer/owner entity
- confirmed_website: official property URL (NOT apartments.com/zillow)
- confirmed_phone: leasing office phone — look for (xxx) xxx-xxxx or xxx-xxx-xxxx format in listings, contact sections, or footer
- is_specific_property: true if results clearly identify ONE specific named property

AMENITY/TECHNOLOGY RULES (look especially in ===AMENITY PAGES===):
- listing_url: apartments.com OR rentcafe.com URL for this property if found
- listing_isp: ISP/internet provider named in amenities — e.g. "GIGstreem", "Hotwire", "Comcast", "AT&T Fiber". Look for: "High-speed internet", "Fiber internet", "Gigabit internet", "Internet included", provider name in amenities list
- listing_cable: cable/satellite/TV provider — e.g. "DirecTV", "Dish", "Spectrum TV", "Xfinity". Look in amenities for "cable", "satellite TV", "DIRECTV"
- listing_proptech: array of ALL named proptech brands — gate systems (DoorKing, LiftMaster, Viking, FAAC), intercoms (ButterflyMX, Aiphone, Viking, 2N), access (Brivo, HID, Openpath, Kisi), cameras (Verkada, Avigilon), smart locks (SmartRent, Latch), any brand name in amenities section
- listing_bulk_detected: true if amenities say "internet included", "fiber included", "tech fee", "technology fee", "cable included", OR any ISP/cable provider explicitly listed as an amenity
- null/[] if not found — never guess`,
    combinedSnippets, 1400, client
  )

  if (!extracted) return blank
  return {
    ...blank,
    ...extracted,
    listing_proptech: normStrArr(extracted.listing_proptech),
    listing_bulk_detected: extracted.listing_bulk_detected ?? false,
  }
}

// ─── PHASE 1B: Prospecting Candidate List ────────────────────────────────────

interface Candidate {
  name: string
  address: string
  city: string
  state: string
  units?: number
  year_built?: number
  property_class?: string
  management_company?: string
  isp_signal?: string
  bulk_detected?: boolean
  pain_brief?: string
  buy_score_estimate?: number
}

interface CandidateResponse {
  type: 'candidates'
  candidates: Candidate[]
  query_interpretation: string
}

async function runPhase1B(query: string, classification: QueryClassification, client: Anthropic): Promise<CandidateResponse> {
  const cityHint = classification.city_hint ?? ''
  const stateHint = classification.state_hint ?? ''
  const mgmtHint = classification.mgmt_hint ?? ''
  const sizeHint = classification.size_hint ?? ''
  const geo = [cityHint, stateHint].filter(Boolean).join(', ')

  // Build 2-3 candidate-finding queries based on query type
  const searches: Promise<TavilyResult[]>[] = []

  if (classification.type === 'city_prospect') {
    searches.push(
      tavilySearch(`${query} multifamily apartments "${cityHint || ''}" "${stateHint || ''}" community list`, 5, 'candidates-1', 'advanced', false),
      serperSearch(`largest apartment communities ${geo} multifamily ${sizeHint ? sizeHint + ' units' : ''}`, 5, 'candidates-2'),
      serperSearch(`${geo} apartments site:apartments.com OR site:rentcafe.com`, 5, 'candidates-3'),
    )
  } else if (classification.type === 'criteria_prospect') {
    searches.push(
      serperSearch(`${query} apartments multifamily ${geo}`, 6, 'candidates-1'),
      tavilySearch(`largest multifamily ${geo} ${mgmtHint} ${sizeHint} units`, 5, 'candidates-2', 'advanced', false),
      serperSearch(`${mgmtHint} ${geo} apartments portfolio properties`, 5, 'candidates-3'),
    )
  } else {
    // contract_prospect
    searches.push(
      serperSearch(`${query} multifamily bulk internet OR "MDU agreement" OR "contract expiring"`, 6, 'candidates-1', 'news'),
      tavilySearch(`apartment ${geo} "bulk agreement" OR "MDU" OR "internet included" expiring`, 5, 'candidates-2', 'advanced', false),
      serperSearch(`${geo} apartments bulk internet OR "internet included" Class A`, 5, 'candidates-3'),
    )
  }

  const results = await Promise.all(searches)
  const allResults = results.flat().filter(r => (r.content || '').length > 30).slice(0, 18)

  if (allResults.length === 0) {
    return { type: 'candidates', candidates: [], query_interpretation: `No properties found for "${query}"` }
  }

  const snippets = allResults
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`)
    .join('\n\n---\n\n')

  const extracted = await haikusExtract<{ candidates: Candidate[]; query_interpretation: string }>(
    `Extract 6-8 candidate properties matching the user's search criteria. Return ONLY valid JSON:
{"candidates":[{"name":"","address":"","city":"","state":"","units":null,"year_built":null,"property_class":null,"management_company":null,"isp_signal":null,"bulk_detected":false,"pain_brief":null,"buy_score_estimate":null}],"query_interpretation":""}

USER QUERY: "${query}"

RULES:
- candidates: 6-8 distinct properties that match the search intent
- name: exact property/community name
- address: street address if available, else null
- city + state: REQUIRED — never null if any location data exists
- units: integer if found in text, else null
- year_built: 4-digit year if found, else null
- property_class: "A", "B", or "C" if mentioned, else null
- management_company: who manages (Greystar, Lincoln, etc.), else null
- isp_signal: ISP name if mentioned (e.g. "GIGstreem", "Comcast"), else null
- bulk_detected: true if internet included / bulk agreement mentioned
- pain_brief: short verbatim resident pain quote if found (e.g. "Internet is terrible, no other options"), else null
- buy_score_estimate: 1-10 — score higher for: pain signals present, bulk detected, large unit count (300+), recent acquisition. Default 5 if uncertain.
- query_interpretation: 1-sentence summary of how you understood the search (e.g. "Multifamily properties in Atlanta with bulk internet agreements and resident pain")

Empty array if no real properties found.`,
    snippets, 2500, client
  )

  if (!extracted) {
    return { type: 'candidates', candidates: [], query_interpretation: `Search completed but extraction failed for "${query}"` }
  }

  const candidates = (extracted.candidates || []).filter(c => normStr(c.name) && (normStr(c.city) || normStr(c.address)))

  return {
    type: 'candidates',
    candidates,
    query_interpretation: normStr(extracted.query_interpretation) || `Properties matching: ${query}`,
  }
}

// ─── PHASE 2: Enrichment (parallel) ─────────────────────────────────────────

interface Phase2Result {
  owner_entity: string
  owner_type: string
  acquisition_year: string
  isp_providers: string[]
  video_providers: string[]
  bulk_detected: boolean
  bulk_agreements: Array<{ provider: string; service_type: string; agreement_type: string; confidence: string; evidence: string; expiry_estimate?: string }>
  fcc_providers: string[]
  roe_detected: boolean
  roe_providers: string[]
  roe_expiry_year: number | null
}

const KNOWN_MDU_BULK_ISPS = new Set([
  'gigstreem', 'hotwire', 'pavlov media', 'mdu communications', 'wired broadband',
  'all west', 'broadstripe', 'sonic mdu', 'xenon networks', 'apogee',
  'limecom', 'pocketinet', 'skybridge', 'bulk solutions', 'enterprise network services',
])

const KNOWN_VIDEO_PROVIDERS = new Set([
  'directv', 'dish network', 'dish tv', 'comcast', 'xfinity', 'spectrum tv',
  'cox', 'mediacom', 'optimum', 'altice', 'breezeline', 'brightspeed', 'frontier',
  'centurylink', 'lumen', 'tds telecom', 'consolidated communications',
])

// ─── Fetch live mdu_providers from DB ────────────────────────────────────────

interface MduProvider { id: string; name: string; provider_type?: string; is_video?: boolean }

async function fetchMduProviders(): Promise<MduProvider[]> {
  try {
    const { data } = await supabaseDeep
      .from('mdu_providers')
      .select('id, name, provider_type, is_video')
      .eq('active', true)
      .limit(80)
    return (data ?? []) as MduProvider[]
  } catch { return [] }
}

async function runPhase2(
  confirmedName: string,
  confirmedAddress: string,
  confirmedCity: string,
  confirmedState: string,
  confirmedMgmt: string,
  coords: { lat: number; lng: number } | null,
  client: Anthropic,
  dbProviders: MduProvider[] = []
): Promise<Phase2Result> {
  const blank: Phase2Result = {
    owner_entity: '', owner_type: '', acquisition_year: '',
    isp_providers: [], video_providers: [],
    bulk_detected: false, bulk_agreements: [], fcc_providers: [],
    roe_detected: false, roe_providers: [], roe_expiry_year: null,
  }

  const geo = [confirmedCity, confirmedState].filter(Boolean).join(', ')

  // Build live keyword lists from DB + known sets
  const dbIspNames = dbProviders
    .filter(p => !p.is_video && p.provider_type !== 'video')
    .map(p => p.name).slice(0, 12)
  const dbVideoNames = dbProviders
    .filter(p => p.is_video || p.provider_type === 'video' || [...KNOWN_VIDEO_PROVIDERS].some(v => p.name.toLowerCase().includes(v)))
    .map(p => p.name).slice(0, 10)

  // Merge DB video names with known set — always include the major players
  const videoKeywords = [...new Set([
    'DirecTV', 'Dish Network', 'Xfinity', 'Comcast', 'Spectrum TV', 'Spectrum',
    ...dbVideoNames,
  ])].slice(0, 10).join(' OR ')

  // MDU ISP keywords from DB + known hardcoded list
  const ispKeywords = [...new Set([
    'GIGstreem', 'Hotwire', '"Pavlov Media"', '"Wired Broadband"', '"MDU Communications"',
    ...dbIspNames.map(n => `"${n}"`),
  ])].slice(0, 10).join(' OR ')

  // Build all DB provider names for Haiku context
  const allDbProviderNames = dbProviders.map(p => p.name).join(', ')

  // Extract brand-name keyword from full management company name
  // "Northland Investment Corporation" → "Northland"
  // Using the full quoted name in Tavily is too restrictive — it requires exact phrase match
  const MGMT_GENERIC_WORDS = new Set(['investment','corporation','corp','inc','llc','management','property','properties','residential','realty','group','real','estate','company','co','partners','fund','capital','asset','homes','apartments','living','communities','associates','equity','ventures','holdings'])
  const mgmtBrandName = confirmedMgmt
    ? (confirmedMgmt.split(/\s+/).find(w => w.length > 2 && !MGMT_GENERIC_WORDS.has(w.toLowerCase())) || confirmedMgmt.split(' ')[0])
    : ''

  const propTarget = mgmtBrandName ? `"${mgmtBrandName}"` : `"${confirmedName}"`
  const geoTarget = `"${confirmedCity}"`

  const [fccProviders, bulkResults, ispCityResults, ownerResults, videoResults, roeResults] = await Promise.all([
    coords ? fccBroadbandLookup(coords.lat, coords.lng) : Promise.resolve([] as string[]),
    tavilySearch(
      // Use brand-name shortening — "Northland" not "Northland Investment Corporation"
      `"${confirmedName}" "${confirmedCity}" ${mgmtBrandName ? `"${mgmtBrandName}"` : ''} bulk internet OR "internet included" OR MDU OR "exclusive provider" OR ${ispKeywords}`,
      5, 'bulk', 'advanced', false
    ),
    // City-level ISP fallback — catches MDU deals that mention the city but not the property name
    serperSearch(
      `"${confirmedCity}" apartments OR "apartment homes" "internet included" OR GIGstreem OR Hotwire OR "bulk internet" OR "MDU internet" OR "exclusive internet" ${mgmtBrandName ? `OR "${mgmtBrandName}"` : ''}`,
      4, 'isp-city'
    ),
    serperSearch(
      `"${confirmedAddress || confirmedName}" sold acquired ownership "private equity" OR REIT`,
      5, 'owner', 'news'
    ),
    // Dedicated video provider search — cable/satellite/IPTV agreements
    serperSearch(
      `${propTarget} OR ${geoTarget} ${videoKeywords} multifamily OR apartment OR MDU OR "bulk video" OR "cable agreement"`,
      5, 'video', 'news'
    ),
    // ROE / bulk telecom agreement search — contract terms + expiry signals
    serperSearch(
      `${propTarget} OR ${geoTarget} "right of entry" OR "ROE agreement" OR "bulk agreement" OR "exclusive service agreement" OR "telecom agreement" OR "internet service agreement" expire OR expiring OR renew OR term OR "contract end"`,
      5, 'roe'
    ),
  ])

  const fccLower = fccProviders.map(p => p.toLowerCase())
  const knownMduInFcc = fccLower.some(p => [...KNOWN_MDU_BULK_ISPS].some(mdu => p.includes(mdu)))

  const allResults = [...bulkResults, ...ispCityResults, ...ownerResults, ...videoResults, ...roeResults]
  const usable = allResults.filter(r => (r.content || '').length > 40).slice(0, 20)

  const snippets = usable
    .map((r, i) => `[${i + 1}][${r.source ?? 'web'}] ${r.title}\n${r.content.slice(0, 400)}`)
    .join('\n\n---\n\n')

  const fccCtx = fccProviders.length > 0
    ? `\n\nFCC BROADBAND MAP (confirmed at coordinates):\n${fccProviders.map(p => `• ${p}`).join('\n')}`
    : ''

  // Check city-level ISP results for known MDU providers — they may confirm bulk deal
  const cityIspLower = ispCityResults.flatMap(r => [r.title, r.content].join(' ').toLowerCase())
  const cityConfirmedIsps = [...KNOWN_MDU_BULK_ISPS].filter(isp => cityIspLower.some(t => t.includes(isp)))

  // Separate video snippets for dedicated extraction
  const videoSnippets = videoResults.filter(r => (r.content || '').length > 30)
    .map((r, i) => `[V${i + 1}] ${r.title}\n${r.content.slice(0, 350)}`).join('\n\n---\n\n')

  // Separate ROE snippets for dedicated extraction
  const roeSnippets = roeResults.filter(r => (r.content || '').length > 30)
    .map((r, i) => `[R${i + 1}] ${r.title}\n${r.content.slice(0, 350)}`).join('\n\n---\n\n')

  const dbProviderCtx = allDbProviderNames
    ? `\n\nKNOWN PROVIDER REFERENCE LIST (from our database — flag any of these if mentioned):\n${allDbProviderNames}`
    : ''

  const extracted = snippets.length > 80
    ? await haikusExtract<Omit<Phase2Result, 'fcc_providers'>>(
        `Extract ownership, connectivity, video service, and ROE agreement data. Return ONLY valid JSON:
{"owner_entity":"","owner_type":"","acquisition_year":"","isp_providers":[],"video_providers":[],"bulk_detected":false,"bulk_agreements":[],"roe_detected":false,"roe_providers":[],"roe_expiry_year":null}

RULES:
- owner_entity: investor/REIT/PE firm/LLC that owns the property
- owner_type: "private_equity","reit","family_office","institutional","local" or ""
- acquisition_year: 4-digit year of last sale/acquisition, or ""
- isp_providers: actual ISPs serving the property (GIGstreem, Hotwire, Comcast, AT&T, Spectrum, etc. — NEVER management company names). Cross-reference the known provider list.
- video_providers: cable/satellite/IPTV services (DirecTV, Dish Network, Comcast Xfinity, Spectrum TV, Cox TV, etc.). Look in [video] source snippets especially. Cross-reference known provider list.
- bulk_detected: true if internet is included in rent, OR bulk/exclusive deal exists, OR "technology fee" / "tech fee" mentioned, OR MDU-only ISP present, OR any telecom agreement found
- bulk_agreements: MAXIMUM 2 total — at most 1 with service_type "internet" AND at most 1 with service_type "video". ONLY include a provider if there is DIRECT EVIDENCE it has an exclusive/bulk/ROE agreement with THIS SPECIFIC PROPERTY (not just the city). Do NOT add providers just because they operate in the metro area or appear in FCC coverage data. The bulk internet provider is typically a single MDU-specialist ISP (e.g. GIGstreem, Hotwire, Pavlov, Bsquared). Return [] if no direct property-level evidence exists. Format:
  [{"provider":"GIGstreem","service_type":"internet","agreement_type":"bulk","confidence":"high","evidence":"internet included in rent","expiry_estimate":"Est. 2027-2029"}]
  service_type: "internet","video","bundled"
  agreement_type: "exclusive","bulk","preferred","unknown"
  expiry_estimate: specific year if mentioned, else estimate from evidence (e.g. "Est. 2027-2029")
- roe_detected: true if any right-of-entry, ROE, exclusive provider, or telecom service agreement language found in [roe] or any snippets
- roe_providers: ALL ISP/cable companies named in ROE, bulk, or exclusive agreements
- roe_expiry_year: 4-digit year when ROE/agreement expires or renews. Extract from: "expires YYYY", "contract ends YYYY", "agreement through YYYY", "renews in YYYY", "term ends YYYY". null if not found${fccCtx}${dbProviderCtx}

SOURCE TAGS IN RESULTS:
- [bulk]: internet/MDU agreement search results — primary ISP source
- [video]: cable/satellite/IPTV search results — primary video source
- [roe]: right-of-entry and contract term search results — primary ROE source
- [owner]: ownership/acquisition news`,
        snippets, 1400, client
      )
    : null

  const result: Phase2Result = { ...blank, ...(extracted || {}), fcc_providers: fccProviders }

  if (knownMduInFcc) {
    result.bulk_detected = true
    const knownFccProviders = fccProviders.filter(p => [...KNOWN_MDU_BULK_ISPS].some(mdu => p.toLowerCase().includes(mdu)))
    for (const kp of knownFccProviders.reverse()) {
      if (!result.isp_providers.includes(kp)) result.isp_providers.unshift(kp)
      if (result.bulk_agreements.length === 0) {
        result.bulk_agreements.push({
          provider: kp,
          service_type: 'internet',
          agreement_type: 'bulk',
          confidence: 'high',
          evidence: `FCC map shows ${kp} — MDU-only ISP, exclusive bulk model`,
        })
      }
    }
  }

  // City-level ISP confirmation — add any MDU providers confirmed from city search
  for (const isp of cityConfirmedIsps) {
    const displayName = fccProviders.find(p => p.toLowerCase().includes(isp)) || isp
    if (!result.isp_providers.some(p => p.toLowerCase().includes(isp))) {
      result.isp_providers.push(displayName)
      result.bulk_detected = true
      if (!result.bulk_agreements.some(a => (a.provider ?? '').toLowerCase().includes(isp))) {
        result.bulk_agreements.push({
          provider: displayName,
          service_type: 'internet',
          agreement_type: 'bulk',
          confidence: 'medium',
          evidence: `${isp} confirmed in ${confirmedCity} multifamily market — MDU-exclusive ISP`,
        })
      }
    }
  }

  // ── Enforce max 1 bulk agreement per service_type ────────────────────────
  // (guards against Haiku or city-search adding multiple internet/video entries)
  const CONF_RANK: Record<string, number> = { confirmed: 4, high: 3, medium: 2, low: 1 }
  const deduped: typeof result.bulk_agreements = []
  for (const svcType of ['internet', 'video', 'bundled'] as const) {
    const matching = result.bulk_agreements.filter(a => a.service_type === svcType)
    if (!matching.length) continue
    const best = matching.reduce((a, b) =>
      (CONF_RANK[a.confidence ?? 'low'] ?? 1) >= (CONF_RANK[b.confidence ?? 'low'] ?? 1) ? a : b
    )
    deduped.push(best)
  }
  result.bulk_agreements = deduped

  return result
}

// ─── PHASE 3: Intelligence (parallel) ───────────────────────────────────────

interface StepContact {
  name: string; title: string; company: string;
  role_type: string; email: string; phone: string;
  linkedin: string; verified?: boolean
}

interface PainSignal {
  type: 'gate' | 'internet' | 'camera' | 'crime' | 'management' | 'smart_lock' | 'general'
  quote: string; source: string; date: string; severity: 'high' | 'medium' | 'low'
}

interface Phase3Result {
  pain_signals: PainSignal[]
  proptech: {
    gate_operators: string[]
    access_control: string[]
    intercoms: string[]
    cameras: string[]
    smart_locks: string[]
    resident_apps: string[]
    package_solutions: string[]
    tech_generation: 'legacy' | 'modern' | 'hybrid'
  }
  contacts: StepContact[]
  email_format: string
  raw_excerpts: TavilyResult[]
}

async function runPhase3(
  confirmedName: string,
  confirmedCity: string,
  confirmedState: string,
  confirmedMgmt: string,
  confirmedOwner: string,
  confirmedWebsite: string,
  client: Anthropic,
  listingProptech: string[] = []
): Promise<Phase3Result> {
  const blank: Phase3Result = {
    pain_signals: [],
    proptech: { gate_operators: [], access_control: [], intercoms: [], cameras: [], smart_locks: [], resident_apps: [], package_solutions: [], tech_generation: 'legacy' },
    contacts: [],
    email_format: '',
    raw_excerpts: [],
  }

  const geo = [confirmedCity, confirmedState].filter(Boolean).join(', ')
  const entity = confirmedMgmt || confirmedOwner

  const mgmtDomain = deriveMgmtDomain(confirmedMgmt) || deriveMgmtDomain(confirmedOwner)
  const websiteDomain = confirmedWebsite
    ? confirmedWebsite.replace(/^https?:\/\//, '').replace(/\/.*/, '').replace(/^www\./, '')
    : ''
  const domainForEmail = mgmtDomain || websiteDomain

  // 5 parallel searches — including social/reviews + raw-content proptech
  const [painResults, proptechResults, contactResults, socialResults, websiteResults] = await Promise.all([
    // Pain signals: Google reviews + resident complaints
    serperSearch(`"${confirmedName}" "${geo}" reviews complaints internet gate crime`, 5, 'pain'),
    // PropTech: raw content fetch — amenities pages explicitly name gate/intercom/camera brands
    tavilySearch(
      `"${confirmedName}" "${geo}" ButterflyMX OR DoorKing OR Brivo OR Openpath OR Verkada OR Avigilon OR SmartRent OR Latch OR LiftMaster OR HID OR SALTO OR Viking OR Linear OR PDK`,
      3, 'proptech', 'advanced', true  // rawContent = TRUE — reads full technology pages
    ),
    // Contacts: LinkedIn
    entity
      ? serperSearch(`"${entity}" "${geo}" "community manager" OR "regional manager" site:linkedin.com`, 5, 'contacts')
      : Promise.resolve([] as TavilyResult[]),
    // Social signals: Reddit + Google reviews + Facebook property page
    serperSearch(
      `"${confirmedName}" "${geo}" (site:reddit.com OR "Google Reviews" OR site:facebook.com OR site:yelp.com) internet OR gate OR management OR crime 2024 OR 2025`,
      6, 'social'
    ),
    // Property website raw content — owner/property site often lists all tech partners + amenities
    confirmedWebsite
      ? tavilySearch(confirmedWebsite, 1, 'website', 'advanced', true)
      : Promise.resolve([] as TavilyResult[]),
  ])

  const allResults = [...painResults, ...proptechResults, ...contactResults, ...socialResults, ...websiteResults]

  // Pain signal extraction — includes social posts (Reddit, Google reviews, Facebook)
  const painAllSources = [...painResults, ...socialResults]
  const painSnippets = painAllSources.filter(r => (r.content || '').length > 40).slice(0, 12)
    .map((r, i) => `[${i + 1}][${r.source ?? 'review'}] ${r.title}\n${r.content.slice(0, 500)}`)
    .join('\n\n---\n\n')

  const painExtracted = painSnippets.length > 80
    ? await haikusExtract<{ signals: PainSignal[] }>(
        `Extract resident pain signals from reviews, Reddit, Google Maps, Facebook posts. Return ONLY valid JSON:
{"signals":[{"type":"gate","quote":"","source":"","date":"","severity":"high"}]}
type: "gate","internet","camera","crime","management","smart_lock","general"
quote: verbatim resident or user quote (max 150 chars) — prioritize direct quotes from real tenants
source: "Google Reviews","Reddit","Facebook","Yelp","ApartmentRatings", etc.
date: any date signal found ("2024","Jan 2025","3 months ago" → approximate year)
severity: high=safety/major failure/no working gate/internet outage, medium=recurring issue, low=minor
Up to 15 signals. Prefer last 18 months. Include internet/gate specific quotes.`,
        painSnippets, 900, client)
    : null

  // PropTech extraction — uses raw content so full page text is available
  // Also pre-seed from Phase 1A listing page findings
  const listingProptechCtx = listingProptech.length > 0
    ? `\n\nALREADY CONFIRMED FROM LISTING PAGE (treat as verified): ${listingProptech.join(', ')}`
    : ''

  // Build proptech snippets: use raw_content if available, else content
  const websiteRaw = websiteResults.filter(r => r.raw_content && r.raw_content.length > 100)
    .map((r, i) => `[W${i + 1}] ${r.url}\n${r.raw_content!.slice(0, 3000)}`).join('\n\n---\n\n')
  const proptechRaw = proptechResults.filter(r => (r.raw_content || r.content || '').length > 40)
    .slice(0, 3)
    .map((r, i) => {
      const body = r.raw_content ? r.raw_content.slice(0, 2500) : r.content.slice(0, 500)
      return `[P${i + 1}] ${r.title}\n${body}`
    }).join('\n\n---\n\n')

  const proptechSnippets = [proptechRaw, websiteRaw].filter(Boolean).join('\n\n===WEBSITE===\n\n')

  const proptechExtracted = proptechSnippets.length > 80
    ? await haikusExtract<Phase3Result['proptech']>(
        `Extract ALL property technology brands mentioned. Return ONLY valid JSON:
{"gate_operators":[],"access_control":[],"intercoms":[],"cameras":[],"smart_locks":[],"resident_apps":[],"package_solutions":[],"tech_generation":"legacy"}
Known brands:
- gate_operators: DoorKing/LiftMaster/Viking/Linear/FAAC/PDK/Elite Gates/LIFTMASTER
- access_control: Brivo/HID/SALTO/Openpath/PDK/Kisi/Allegion/Schlage/Nexkey
- intercoms: ButterflyMX/Aiphone/Viking/2N/Doorbird/Verkada Door/Doorbell Camera/CallBox
- cameras: Verkada/Avigilon/EagleEye/Hanwha/Axis/Hikvision/Dahua/Bosch
- smart_locks: SmartRent/GateWise/Latch/August/Yale/Schlage/Kwikset/igloohome
- resident_apps: SmartRent/Entrata/RealPage/Yardi/AppFolio/Rent Manager/BuildingLink
- package_solutions: "Parcel Pending"/"Amazon Hub"/"Package Concierge"/"Luxer One"/"Fetch"
tech_generation: "legacy"=pre-2018 brands dominant, "modern"=2018+ brands, "hybrid"=mix
IMPORTANT: scan full page text — proptech brands often appear in: "Community Features", "Building Features", "Amenities", "Technology", "Access" sections${listingProptechCtx}`,
        proptechSnippets, 800, client)
    : null

  // Contact extraction
  const contactSnippets = contactResults.filter(r => (r.content || '').length > 30).slice(0, 8)
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content.slice(0, 350)}`).join('\n\n---\n\n')

  const contactExtracted = contactSnippets.length > 60
    ? await haikusExtract<{ contacts: Array<StepContact & { linkedin_url?: string }> }>(
        `Extract every named individual at "${entity}" or "${confirmedName}". Return ONLY valid JSON:
{"contacts":[{"name":"","title":"","company":"","role_type":"property_manager","email":"","phone":"","linkedin":""}]}
role_type: "property_manager","regional_manager","asset_manager","corporate"
- email: any address found, even partial
- phone: any phone number
- linkedin: full LinkedIn URL if present
- Only real "First Last" names (no companies or titles as names)
- Include LinkedIn search hits even with brief snippets — URL alone proves existence
- If LinkedIn slug contains a name, infer it
- Empty array if no names found`,
        contactSnippets, 700, client)
    : null

  const webContacts: StepContact[] = ((contactExtracted?.contacts ?? []) as StepContact[])
    .filter(c => normStr(c.name) !== null && c.name.includes(' '))

  // Apollo + NinjaPear + Email Format — all parallel
  const topContact = webContacts[0]
  const topContactParts = topContact?.name?.trim().split(/\s+/) ?? []
  const contactCompany = topContact?.company || ''
  const apolloDomain =
    deriveMgmtDomain(contactCompany) ||
    deriveMgmtDomain(confirmedMgmt) ||
    deriveMgmtDomain(confirmedOwner) ||
    domainForEmail

  const emailFormatP: Promise<string> = (async () => {
    if (!domainForEmail) return ''
    const efResults = await serperSearch(
      `"${domainForEmail}" email format site:hunter.io OR site:emailformat.com`,
      3, 'email-format'
    )
    const efSnippets = efResults.filter(r => (r.content || '').length > 20).slice(0, 4).map(r => r.content.slice(0, 250)).join('\n')
    if (!efSnippets) return ''
    const efResult = await haikusExtract<{ format: string }>(
      `Find the standard email format for domain "${domainForEmail}". Return ONLY valid JSON: {"format":""}
Examples: "firstname.lastname@domain.com", "flastname@domain.com", "firstname@domain.com"`,
      efSnippets, 80, client)
    return normStr(efResult?.format) || ''
  })()

  const [emailFormat, apolloTopResult, ninjaProfile] = await Promise.all([
    emailFormatP,
    (topContact?.name && apolloDomain)
      ? apolloEnrichPerson(topContact.name, apolloDomain)
      : Promise.resolve(null),
    (topContact?.name && topContact.name.includes(' ') && (apolloDomain || domainForEmail))
      ? ninjapearValidatePerson(topContactParts[0], topContactParts[topContactParts.length - 1], apolloDomain || domainForEmail)
      : Promise.resolve(null),
  ])

  const allContacts: StepContact[] = [...webContacts]

  // Patch Apollo email + phone onto top contact
  if (apolloTopResult && topContact) {
    const idx = allContacts.findIndex(c => c.name.toLowerCase() === topContact.name.toLowerCase())
    if (idx >= 0) {
      if (apolloTopResult.email) allContacts[idx].email = apolloTopResult.email
      if (apolloTopResult.phone_numbers?.[0]) allContacts[idx].phone = apolloTopResult.phone_numbers[0]
      if (apolloTopResult.title) allContacts[idx].title = apolloTopResult.title
      if (apolloTopResult.linkedin_url) allContacts[idx].linkedin = apolloTopResult.linkedin_url
    }
  }

  // Patch NinjaPear validation
  if (ninjaProfile && topContact) {
    const currentExp = (ninjaProfile.work_experience ?? []).find(e => e.end_date === null)
    const idx = allContacts.findIndex(c => c.name.toLowerCase() === topContact.name.toLowerCase())
    if (idx >= 0) {
      if (currentExp?.role) allContacts[idx].title = currentExp.role
      if (currentExp) allContacts[idx].verified = true
    }
  }

  // Construct fallback emails for contacts missing one
  allContacts.forEach(c => {
    if (!c.email && c.name && c.name.includes(' ')) {
      const contactDomain =
        deriveMgmtDomain(c.company || '') ||
        deriveMgmtDomain(confirmedMgmt) ||
        deriveMgmtDomain(confirmedOwner) ||
        domainForEmail
      if (contactDomain) {
        const parts = c.name.trim().split(/\s+/)
        const first = parts[0], last = parts[parts.length - 1]
        c.email = constructEmail(first, last, contactDomain, emailFormat)
      }
    }
  })

  // Merge listing-verified proptech into extracted proptech
  // listingProptech is already confirmed from amenity page — never discard it
  const finalProptech: Phase3Result['proptech'] = {
    ...(proptechExtracted ?? blank.proptech),
  }
  if (listingProptech.length > 0 && proptechExtracted) {
    // Distribute listing proptech brands into the right category arrays
    for (const brand of listingProptech) {
      const b = brand.toLowerCase()
      if (['butterflyMX','aiphone','2n','doorbird','callbox'].some(i => b.includes(i.toLowerCase()))) {
        if (!finalProptech.intercoms.some(x => x.toLowerCase() === b)) finalProptech.intercoms.push(brand)
      } else if (['brivo','hid','openpath','kisi','salto','pdk','allegion'].some(i => b.includes(i.toLowerCase()))) {
        if (!finalProptech.access_control.some(x => x.toLowerCase() === b)) finalProptech.access_control.push(brand)
      } else if (['liftmaster','doorking','viking','linear','faac','elite'].some(i => b.includes(i.toLowerCase()))) {
        if (!finalProptech.gate_operators.some(x => x.toLowerCase() === b)) finalProptech.gate_operators.push(brand)
      } else if (['verkada','avigilon','eagle','hanwha','axis','hikvision','dahua'].some(i => b.includes(i.toLowerCase()))) {
        if (!finalProptech.cameras.some(x => x.toLowerCase() === b)) finalProptech.cameras.push(brand)
      } else if (['smartrent','latch','august','yale','schlage','kwikset','gatewise'].some(i => b.includes(i.toLowerCase()))) {
        if (!finalProptech.smart_locks.some(x => x.toLowerCase() === b)) finalProptech.smart_locks.push(brand)
      }
      // If brand doesn't fit known categories, still log it (Sonnet will categorize it)
    }
  }

  return {
    pain_signals: painExtracted?.signals ?? [],
    proptech: finalProptech,
    contacts: allContacts,
    email_format: emailFormat,
    raw_excerpts: allResults,
  }
}

// ─── Synthesis tool schema ────────────────────────────────────────────────────

const deepIntelTool: Anthropic.Tool = {
  name: 'aria_deep_intel_result',
  description: 'Return the structured deep property intelligence report.',
  input_schema: {
    type: 'object' as const,
    required: ['property_details', 'isp_providers', 'video_providers', 'bulk_agreements', 'extracted_contacts', 'key_finding', 'confidence', 'proptech', 'pain_signals'],
    properties: {
      property_details: {
        type: 'object',
        properties: {
          units: { type: 'number' }, year_built: { type: 'number' },
          management_company: { type: 'string' }, property_type: { type: 'string' },
          class: { type: 'string' }, occupancy: { type: 'string' },
        },
      },
      isp_providers: { type: 'array', items: { type: 'string' } },
      video_providers: { type: 'array', items: { type: 'string' } },
      bulk_agreements: {
        type: 'array',
        items: {
          type: 'object',
          required: ['provider', 'service_type', 'agreement_type', 'expiry_estimate', 'confidence', 'evidence', 'evidence_source'],
          properties: {
            provider: { type: 'string' }, service_type: { type: 'string', enum: ['internet', 'video', 'bundled'] },
            agreement_type: { type: 'string', enum: ['exclusive', 'bulk', 'preferred', 'unknown'] },
            expiry_estimate: { type: 'string' }, confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
            evidence: { type: 'string' }, evidence_source: { type: 'string' },
          },
        },
      },
      extracted_contacts: {
        type: 'array',
        description: 'Strict contact schema — every item must have all fields. phone: raw number OR "Apollo Missing – Defaulting to Office: {number}" if no direct line. phone_source: "direct" if Apollo returned a line, "office_main" if falling back to leasing office, null if neither.',
        items: {
          type: 'object',
          required: ['name', 'title', 'company', 'email', 'phone', 'phone_source', 'linkedin_slug'],
          properties: {
            name: { type: 'string' },
            title: { type: 'string' },
            company: { type: 'string' },
            email: { type: 'string', description: 'Email address or empty string — never null' },
            phone: { type: 'string', description: 'Direct number, "Apollo Missing – Defaulting to Office: XXX" if office fallback, or "" if none' },
            phone_source: { type: ['string', 'null'], enum: ['direct', 'office_main', null], description: '"direct" = Apollo returned a line; "office_main" = falling back to leasing office; null = no phone' },
            linkedin_slug: { type: 'string', description: 'LinkedIn path after /in/ — no full URL' },
          },
        },
      },
      key_finding: { type: 'string' },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      units: { type: 'number' }, year_built: { type: 'number' },
      property_class: { type: 'string', enum: ['A', 'B', 'C'] },
      property_type: { type: 'string' },
      atlas_opportunity: { type: 'boolean' }, edgar_signal: { type: 'boolean' }, permit_signal: { type: 'boolean' },
      ownership: {
        type: 'object',
        properties: {
          owner_entity: { type: 'string' }, owner_type: { type: 'string' },
          portfolio_size: { type: 'string' }, acquisition_year: { type: 'string' },
          capex_signal: { type: 'string' }, sec_filing_ref: { type: 'string' },
        },
      },
      proptech: {
        type: 'object',
        properties: {
          gate_operators: { type: 'array', items: { type: 'string' } },
          access_control: { type: 'array', items: { type: 'string' } },
          intercoms: { type: 'array', items: { type: 'string' } },
          cameras: { type: 'array', items: { type: 'string' } },
          smart_locks: { type: 'array', items: { type: 'string' } },
          resident_apps: { type: 'array', items: { type: 'string' } },
          package_solutions: { type: 'array', items: { type: 'string' } },
          tech_generation: { type: 'string', enum: ['legacy', 'modern', 'hybrid'] },
          sara_signals: { type: 'boolean' },
          replacement_window: { type: 'string' },
          displacement_targets: { type: 'array', items: { type: 'string' } },
        },
      },
      pain_signals: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            source: { type: 'string' }, date: { type: 'string' },
            signal_type: { type: 'string', enum: ['gate_access', 'internet', 'package_theft', 'intercom', 'general'] },
            quote: { type: 'string' }, severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          },
        },
      },
      behavioral_profile: {
        type: 'object',
        properties: {
          personality_type: { type: 'string' }, decision_style: { type: 'string' },
          risk_tolerance: { type: 'string' }, communication_pref: { type: 'string' },
          budget_orientation: { type: 'string' },
        },
      },
      pitch_strategy: {
        type: 'object',
        properties: {
          primary_hook: { type: 'string' },
          secondary_hooks: { type: 'array', items: { type: 'string' } },
          avoid: { type: 'array', items: { type: 'string' } },
        },
      },
      freshness_score: { type: 'number' },
      buying_trends: { type: 'string' },
    },
  },
}

// ─── Parallel Haiku: 6-month outreach campaign generator ─────────────────────
// Runs alongside the Sonnet synthesis call — Haiku is ~5x faster so it finishes
// first and the result is ready when Promise.all([sonnet, outreachPlan]) resolves.

interface OutreachMonth {
  theme: string
  actions: string[]
  goal: string
}

interface OutreachPlan {
  month_1: OutreachMonth; month_2: OutreachMonth; month_3: OutreachMonth
  month_4: OutreachMonth; month_5: OutreachMonth; month_6: OutreachMonth
  total_touches: number
  primary_channel: string
  key_milestone: string
  expected_close_quarter: string
}

async function generateOutreachPlan(
  propertyName: string,
  city: string,
  units: number | null,
  ispProviders: string[],
  roeExpiry: number | null,
  bulkDetected: boolean,
  painSignals: PainSignal[],
  behavioralProfile: Record<string, string> | null,
  pitchStrategy: Record<string, unknown> | null,
  acquisitionYear: string,
  client: Anthropic
): Promise<OutreachPlan | null> {
  const topPain = painSignals.slice(0, 3).map(s => `"${s.quote}" (${s.type})`).join('; ')
  const isp = ispProviders[0] || 'unknown ISP'
  const contractCtx = roeExpiry
    ? `ROE/bulk agreement expires ${roeExpiry}`
    : bulkDetected ? 'Bulk agreement detected — expiry unknown'
    : 'No bulk agreement detected — displacement opportunity'
  const behCtx = behavioralProfile
    ? `Decision style: ${behavioralProfile.decision_style || 'unknown'}. Channel pref: ${behavioralProfile.communication_pref || 'email'}. Risk: ${behavioralProfile.risk_tolerance || 'medium'}.`
    : 'No behavioral data.'
  const pitchHook = (pitchStrategy as any)?.primary_hook || ''

  const prompt = `Build a 6-month sales outreach campaign for a GateGuard rep targeting this property.

PROPERTY: ${propertyName}, ${city}${units ? ` (${units} units)` : ''}
CONTRACT: ${contractCtx}
CURRENT ISP: ${isp}
PAIN SIGNALS: ${topPain || 'None found'}
BEHAVIORAL PROFILE: ${behCtx}
PITCH HOOK: ${pitchHook}
${acquisitionYear ? `NEW OWNERSHIP: Acquired ${acquisitionYear} — capex window likely open` : ''}

Return ONLY valid JSON — no text outside the JSON block:
{
  "month_1": {"theme": "First Touch — Awareness", "actions": ["Send intro email referencing [specific pain or ROE insight]", "Connect on LinkedIn with personalized note", "Research gate/access system details for site"], "goal": "Get on their radar with a relevant, specific opener"},
  "month_2": {"theme": "Education — Value Proof", "actions": [], "goal": ""},
  "month_3": {"theme": "Validation — Demo Request", "actions": [], "goal": ""},
  "month_4": {"theme": "Proposal Prep — Site Walk", "actions": [], "goal": ""},
  "month_5": {"theme": "Proposal Delivery", "actions": [], "goal": ""},
  "month_6": {"theme": "Close / Urgency", "actions": [], "goal": ""},
  "total_touches": 18,
  "primary_channel": "email",
  "key_milestone": "ROE expires [year] — proposal must land 90 days prior",
  "expected_close_quarter": "Q3 2026"
}

RULES:
- Each month: theme (short title), actions (3-4 specific tasks using THIS property's data), goal (1-sentence outcome)
- Actions must reference real details: the ISP name, the pain signal quotes, the contract window
- primary_channel: "email"/"phone"/"linkedin" based on behavioral profile
- key_milestone: most important event in window (ROE expiry, new ownership capex cycle, or biggest pain signal)
- expected_close_quarter: based on contract window + typical 6-month sales cycle
- total_touches: total action count across all 6 months`

  return await haikusExtract<OutreachPlan>(prompt, '', 1200, client)
}

// ─── Haiku: Gatekeeper navigation tip ────────────────────────────────────────
// Generates a 1-2 sentence cold-call script for reaching a property manager
// through a leasing office receptionist. Runs in parallel with Sonnet synthesis.

async function generateGatekeeperTip(
  contactName: string,
  contactTitle: string,
  propertyName: string,
  managementCompany: string,
  officePhone: string | null,
  ispProvider: string,
  client: Anthropic
): Promise<string | null> {
  if (!contactName) return null
  const phoneCtx = officePhone ? ` Call ${officePhone}.` : ''
  const result = await haikusExtract<{ tip: string }>(
    `Write a gatekeeper navigation script for a GateGuard sales rep trying to reach ${contactName} (${contactTitle || 'property decision-maker'}) at "${propertyName}"${managementCompany ? ` (${managementCompany})` : ''}.${phoneCtx}

GateGuard installs gate, access control, and intercom systems for multifamily properties. Current provider: ${ispProvider || 'unknown'}.

Return ONLY valid JSON: {"tip":""}

The script must:
- Be 1-2 sentences, conversational tone
- Tell the rep to ask for the contact by first name
- Give a professional non-sales-y reason: reference a "connectivity and access review" or the property's "upcoming gate system assessment"
- Include a brief objection-handler if blocked ("they were expecting my call regarding...")
Example output: "Ask for [First Name] by name. If blocked: 'I'm following up with [First Name] about the gate and access control assessment we have scheduled for the property — they're expecting my call.'"`,
    '', 250, client
  )
  return normStr(result?.tip) || null
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!process.env.TAVILY_API_KEY) return NextResponse.json({ error: 'TAVILY_API_KEY not configured' }, { status: 503 })

    const raw = await req.json()
    const rawQuery: string = raw.property_name || raw.query || ''
    if (!rawQuery) return NextResponse.json({ error: 'property_name or query required' }, { status: 400 })

    // ── PHASE 0: Classification ───────────────────────────────────────────────
    const classification = await classifyQuery(rawQuery, anthropic)

    // ── PHASE 1B: Prospecting (city/criteria/contract queries) ────────────────
    if (classification.type !== 'specific_property') {
      const candidateResult = await runPhase1B(rawQuery, classification, anthropic)
      return NextResponse.json({
        type: 'candidates',
        mode: 'candidates',
        engine_version: ARIA_ENGINE_VERSION,
        candidates: candidateResult.candidates,
        query_interpretation: candidateResult.query_interpretation,
      })
    }

    // ── PHASE 1A + DB lookback in parallel ───────────────────────────────────
    const [p1, existingRecord] = await Promise.all([
      runPhase1A(rawQuery, anthropic),
      lookupExistingProperty(rawQuery, classification.city_hint),
    ])

    // ── Merge Phase 1A with existing DB record (DB fills gaps, fresh wins) ───
    const property_name = p1.confirmed_name || existingRecord?.property_name || rawQuery
    const address = p1.confirmed_address || existingRecord?.address || ''
    const city = p1.confirmed_city || classification.city_hint || ''
    const state = p1.confirmed_state || classification.state_hint || ''
    const mgmt = p1.confirmed_management || existingRecord?.management_company || classification.mgmt_hint || ''
    const owner = p1.confirmed_owner || existingRecord?.owner_entity || ''
    const website = p1.confirmed_website || ''

    // Log Phase 1A amenity findings — these are gold (listing page verified)
    if (p1.listing_isp) console.log(`[aria] Phase1A amenity ISP: ${p1.listing_isp}`)
    if (p1.listing_cable) console.log(`[aria] Phase1A amenity cable: ${p1.listing_cable}`)
    if (p1.listing_proptech.length) console.log(`[aria] Phase1A amenity proptech: ${p1.listing_proptech.join(', ')}`)

    // Pre-seed Phase 2: DB data + Phase 1A listing-verified amenity data
    // Priority: user-verified DB > listing-page verified > AI search results
    const listingVerifiedIsps = p1.listing_isp ? [p1.listing_isp] : []
    const listingVerifiedVideos = p1.listing_cable ? [p1.listing_cable] : []

    const dbPhase2Seed = {
      isp_providers:    [...new Set([...(existingRecord?.isp_providers ?? []), ...listingVerifiedIsps])],
      video_providers:  [...new Set([...(existingRecord?.video_providers ?? []), ...listingVerifiedVideos])],
      roe_expiry_year:  existingRecord?.roe_expiry_user_verified
        ? (existingRecord.roe_expiry_year ?? null) : null,
      roe_providers:    existingRecord?.roe_providers ?? [],
      roe_detected:     (existingRecord?.roe_detected ?? false) || p1.listing_bulk_detected,
      bulk_agreements:  existingRecord?.bulk_agreements ?? [],
      // Listing-page bulk detection: if ISP/cable listed as amenity, create a seed agreement
      listing_bulk_detected: p1.listing_bulk_detected,
    }

    // If listing page confirmed bulk, create a seed agreement entry
    if (p1.listing_bulk_detected && p1.listing_isp && dbPhase2Seed.bulk_agreements.length === 0) {
      dbPhase2Seed.bulk_agreements = [{
        provider: p1.listing_isp,
        service_type: 'internet',
        agreement_type: 'bulk',
        confidence: 'high',
        evidence: `Listed as amenity on property listing page (${p1.listing_url || 'listing site'})`,
      }]
    }

    if (existingRecord?.times_researched) {
      console.log(`[aria] Re-searching known property: ${property_name} (researched ${existingRecord.times_researched}x)`)
    }

    // STOP: only if we have zero identity signal — confirmed_name alone is enough to proceed
    if (!city && !state && !p1.is_specific_property && !p1.confirmed_name && !property_name) {
      return NextResponse.json({ error: 'Property not found. Try a more specific query (include city/state).' }, { status: 404 })
    }

    // Geocode
    const coords = await geocodeAddress(address || property_name, city, state)

    // ── PHASES 2 + 3 in parallel (+ mdu_providers DB fetch) ──────────────────
    const [p2Raw, p3] = await Promise.all([
      fetchMduProviders().then(dbProviders =>
        runPhase2(property_name, address, city, state, mgmt, coords, anthropic, dbProviders)
      ),
      // Pass Phase 1A listing data into Phase 3 so proptech pre-seeded from amenities
      runPhase3(property_name, city, state, mgmt, owner, website, anthropic, p1.listing_proptech),
    ])

    // Merge Phase 2 with DB+listing seed — user-verified DB > listing-verified > AI
    const p2: typeof p2Raw = {
      ...p2Raw,
      isp_providers: [
        ...new Set([...(dbPhase2Seed.isp_providers), ...p2Raw.isp_providers])
      ],
      video_providers: [
        ...new Set([...(dbPhase2Seed.video_providers), ...p2Raw.video_providers])
      ],
      roe_expiry_year: dbPhase2Seed.roe_expiry_year ?? p2Raw.roe_expiry_year,
      roe_providers: [
        ...new Set([...(dbPhase2Seed.roe_providers), ...p2Raw.roe_providers])
      ],
      roe_detected: p2Raw.roe_detected || dbPhase2Seed.roe_detected || false,
      // Merge bulk agreements: DB+listing agreements merged with new findings
      bulk_agreements: (() => {
        const dbAgreements = dbPhase2Seed?.bulk_agreements ?? []
        const newAgreements = p2Raw.bulk_agreements
        if (!dbAgreements.length) return newAgreements
        if (!newAgreements.length) return dbAgreements
        // Union: prefer higher-confidence / user-verified
        const result = [...dbAgreements]
        for (const na of newAgreements) {
          const key = `${(na.provider ?? '').toLowerCase()}:${na.service_type ?? ''}`
          const exists = result.find(e => `${(e.provider ?? '').toLowerCase()}:${e.service_type ?? ''}` === key)
          if (!exists) result.push(na)
        }
        return result
      })(),
    }

    const finalOwner = p2.owner_entity || owner || ''

    // ── Determine best contact early — needed for gatekeeper tip ─────────────
    const earlyBestContact = p3.contacts.find(c => c.role_type === 'property_manager')
      || p3.contacts.find(c => c.role_type === 'regional_manager')
      || p3.contacts.find(c => c.role_type === 'asset_manager')
      || p3.contacts[0]

    // Leasing office phone (Phase 1A — confirmed from listing page)
    const officePhone = normStr(p1.confirmed_phone)

    // ── PHASE 4: Synthesis ────────────────────────────────────────────────────
    const synthesisData = `PHASE 1 — VERIFIED IDENTITY:
${JSON.stringify({ name: property_name, address, city, state, units: p1.confirmed_units, year_built: p1.confirmed_year_built, management_company: mgmt, website, phone: p1.confirmed_phone }, null, 2)}

PHASE 2 — ENRICHMENT:
${JSON.stringify({ owner_entity: finalOwner, owner_type: p2.owner_type, acquisition_year: p2.acquisition_year, fcc_providers: p2.fcc_providers, isp_providers: p2.isp_providers, video_providers: p2.video_providers, bulk_detected: p2.bulk_detected, bulk_agreements: p2.bulk_agreements, roe_detected: p2.roe_detected, roe_providers: p2.roe_providers, roe_expiry_year: p2.roe_expiry_year }, null, 2)}

PHASE 3 — INTELLIGENCE:
${JSON.stringify({ pain_signals: p3.pain_signals.slice(0, 12), proptech: p3.proptech, contact_count: p3.contacts.length, email_format: p3.email_format }, null, 2)}`

    // ── PHASE 4: Sonnet synthesis + Haiku outreach plan — run in PARALLEL ───────
    // Haiku is ~5x faster than Sonnet; both kick off at the same time so the
    // outreach plan is ready by the time Sonnet finishes. This prevents the
    // outreach plan from adding any latency to the critical path.
    const [message, outreachPlanResult, gatekeeperTipResult] = await Promise.all([
      anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2800,
        tools: [deepIntelTool],
        tool_choice: { type: 'tool', name: 'aria_deep_intel_result' },
        system: `You assemble step-verified data into a final property intelligence report. Phases 1-3 are ground truth — copy directly. Use synthesis only to fill gaps and write the sales brief.

CRITICAL RULES:
1. property_details.units: copy from Phase 1
2. property_details.management_company: copy from Phase 1 — NEVER overwrite with a person's name
3. isp_providers: copy from Phase 2 isp_providers. If fcc_providers has names not in isp_providers, add them.
4. video_providers: copy from Phase 2 video_providers. Look for DirecTV, Dish, Comcast, Xfinity, Spectrum, cable, satellite — populate this array, do NOT leave it empty if any evidence exists.
5. bulk_agreements: copy ALL from Phase 2. Include video agreements (DirecTV MDU, Spectrum TV bulk) separately from internet agreements. For each agreement:
   - If roe_expiry_year is set → use it as expiry_estimate
   - Else if year_built known: MDU fiber = year_built+7 to year_built+10; cable bulk = year_built+5 to year_built+8
   - Set expiry_estimate = "Est. [year]-[year+2]" or specific year if known
6. proptech: copy from Phase 3
7. extracted_contacts: copy from Phase 3 contacts. STRICT SCHEMA — every item must have: name (string), title (string), company (string), email (string or ""), phone (raw number OR "Apollo Missing – Defaulting to Office: {leasing_number}" OR ""), phone_source ("direct"|"office_main"|null), linkedin_slug (path after /in/ or ""). Never omit fields, never use null for string fields.
8. pain_signals: copy from Phase 3 — up to 12 recent
9. ownership: build from Phase 2 owner_entity + owner_type + acquisition_year
10. If management_company blank but owner is RE firm → set management_company = owner_entity
11. proptech.replacement_window: based on tech_generation + year_built (pre-2015=Immediate, 2015-19=1-3yr, 2020+=3-5yr)

ROE / CONTRACT DATA:
- Phase 2 includes roe_detected, roe_providers, roe_expiry_year — use these to populate bulk_agreements
- If roe_expiry_year is present: set capex_signal = "ROE expires [year] — contract window open"
- If roe_detected and no year: set capex_signal = "ROE/bulk agreement detected — verify expiry"

CONTRACT WINDOW:
- If acquisition_year is last 2 years: add "New ownership — capex window open" to capex_signal

CONTACT PRIORITY: Property Manager > Regional > Asset Manager > CEO

key_finding: "[WHO] at [company] controls this. [WHY NOW: specific pain/contract/acquisition/ROE signal]"
pitch_strategy.primary_hook: 1 sentence using THIS property's pain + contract/ROE window
behavioral_profile: decision_style, communication_pref, risk_tolerance, budget_orientation
freshness_score (1-10): 10=ROE expiry known + recent acquisition; 8=contract expiry/bulk detected; 6=pain signals; 4=basic intel; 2=inference only
buying_trends: 1-sentence sales trend insight for this property type`,
        messages: [{ role: 'user', content: `Property: ${property_name}\nLocation: ${city}, ${state}\n\n${synthesisData}` }],
      }),
      // Haiku generates the 6-month outreach plan in parallel — adds zero latency
      generateOutreachPlan(
        property_name, city,
        p1.confirmed_units,
        p2.isp_providers,
        p2.roe_expiry_year,
        p2.bulk_detected,
        p3.pain_signals,
        null, // behavioral_profile not yet available (Sonnet hasn't finished)
        null, // pitch_strategy not yet available
        p2.acquisition_year,
        anthropic
      ),
      // Haiku generates a gatekeeper navigation script in parallel (fast, ~0.5s)
      generateGatekeeperTip(
        normStr(earlyBestContact?.name) ?? '',
        normStr(earlyBestContact?.title) ?? '',
        property_name,
        mgmt,
        officePhone,
        p2.isp_providers[0] || '',
        anthropic
      ),
    ])

    const toolBlock = message.content.find(b => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined
    if (!toolBlock) throw new Error('No synthesis result from Claude')
    const rawData = toolBlock.input as Record<string, any>

    // outreachPlanResult is ready — Haiku finished while Sonnet was synthesising
    const outreachPlan = outreachPlanResult ?? null

    // ── Build final payload ───────────────────────────────────────────────────
    const cleanIspProviders = normStrArr(p2.isp_providers.length ? p2.isp_providers : (rawData.isp_providers ?? []))
    const cleanVideoProviders = normStrArr(p2.video_providers.length ? p2.video_providers : (rawData.video_providers ?? []))
    const cleanBulkAgreements = p2.bulk_agreements.length ? p2.bulk_agreements : (rawData.bulk_agreements ?? [])

    const mergedDMChain = p3.contacts.filter(c => c.name).map(c => {
      const directPhone = normStr(c.phone)
      return {
        name: c.name, title: c.title, company: c.company || mgmt || finalOwner,
        role_type: c.role_type, email: c.email, top_email_format: p3.email_format,
        // Phone hierarchy: direct line first, then leasing office, then empty
        phone: directPhone ?? (officePhone ?? ''),
        phone_source: (directPhone ? 'direct' : (officePhone ? 'office_main' : null)) as 'direct' | 'office_main' | null,
        linkedin_slug: c.linkedin?.split('/in/')?.[1] || '',
        gatekeeper_tip: null as string | null, // patched onto primary DM below
      }
    })

    // Patch gatekeeper tip onto the primary DM in the chain
    if (mergedDMChain.length > 0 && gatekeeperTipResult) {
      mergedDMChain[0].gatekeeper_tip = gatekeeperTipResult
    }

    const bestContact = earlyBestContact

    const fallback = (rawData.extracted_contacts || [])[0] || {}

    // Extract contract expiry year for intel DB
    const contractExpiryYear = (() => {
      for (const a of cleanBulkAgreements) {
        const m = (a.expiry_estimate ?? '').match(/20\d{2}/)
        if (m) return parseInt(m[0], 10)
      }
      return null
    })()

    const scoutQueue = {
      property: {
        name: property_name, address, city, state,
        units: p1.confirmed_units, class: rawData.property_class || null,
        year_built: p1.confirmed_year_built || null,
        management_company: mgmt, owner_entity: finalOwner, old_name: null,
      },
      market_context: {
        property_class: rawData.property_class || null,
        year_built: p1.confirmed_year_built || null,
        tech_generation: p3.proptech.tech_generation,
        replacement_window: normStr(rawData.proptech?.replacement_window) || null,
        acquisition_year: normStr(p2.acquisition_year) || null,
        owner_type: normStr(p2.owner_type) || null,
        sara_signals: rawData.proptech?.sara_signals ?? false,
        buying_trends: normStr(rawData.buying_trends) || null,
      },
      pain_angles: p3.pain_signals.slice(0, 8).map(s => ({ type: s.type, quote: s.quote, severity: s.severity })),
      connectivity: {
        isp_providers: cleanIspProviders,
        video_providers: cleanVideoProviders,
        bulk_detected: p2.bulk_detected,
        provider_confirmed: cleanIspProviders.length > 0,
        bulk_agreements: cleanBulkAgreements,
        roe_detected: p2.roe_detected,
        roe_providers: p2.roe_providers,
        roe_expiry_year: p2.roe_expiry_year,
        contract_urgency: (p2.roe_detected || p2.bulk_detected) ? 'high' : 'medium',
        contract_window: p2.roe_expiry_year
          ? `ROE expires ${p2.roe_expiry_year}`
          : normStr((cleanBulkAgreements[0] as any)?.expiry_estimate) || null,
      },
      proptech: {
        gate_operators: p3.proptech.gate_operators,
        access_control: p3.proptech.access_control,
        intercoms: p3.proptech.intercoms,
        cameras: p3.proptech.cameras,
        smart_locks: p3.proptech.smart_locks,
        tech_generation: p3.proptech.tech_generation,
        displacement_targets: normStrArr(rawData.proptech?.displacement_targets),
        sara_signals: rawData.proptech?.sara_signals ?? false,
      },
      contact_chain: mergedDMChain.slice(0, 5),
      email_format: p3.email_format,
      behavioral_profile: rawData.behavioral_profile ?? null,
      pitch_strategy: rawData.pitch_strategy ?? null,
      key_finding: normStr(rawData.key_finding) ?? null,
      objection_flags: [
        ...(p2.bulk_detected && cleanIspProviders.length > 0 ? [`Existing bulk deal with ${cleanIspProviders[0]} — needs contract expiry`] : []),
        ...(p2.roe_detected && !p2.roe_expiry_year ? ['ROE detected — expiry date unknown, verify with property'] : []),
        ...(p2.roe_expiry_year ? [`ROE expires ${p2.roe_expiry_year} — contract window opens soon`] : []),
        ...(p2.acquisition_year && parseInt(p2.acquisition_year) >= new Date().getFullYear() - 1 ? ['Recent acquisition — capex window open'] : []),
      ],
      outreach_plan: outreachPlan,
      outreach_sequence: ['email_1', 'call_1', 'linkedin_touch', 'email_2', 'call_2', 'email_3'],
    }

    const prospectPayload = {
      property: {
        name: property_name,
        address: normStr(address) || property_name,
        city: city || null,
        state: state || null,
        units: normInt(p1.confirmed_units ?? rawData.property_details?.units ?? rawData.units),
        property_type: normStr(rawData.property_details?.property_type) ?? 'multifamily',
        class: normStr(rawData.property_details?.class ?? rawData.property_class),
        year_built: normInt(p1.confirmed_year_built ?? rawData.property_details?.year_built ?? rawData.year_built),
        occupancy: normStr(rawData.property_details?.occupancy),
        management_company: normStr(mgmt ?? rawData.property_details?.management_company) || normStr(finalOwner ?? rawData.ownership?.owner_entity) || null,
        owner_entity: normStr(finalOwner || rawData.ownership?.owner_entity),
        old_name: null,
        phone: normStr(p1.confirmed_phone),
        website: normStr(website),
        isp_providers: cleanIspProviders,
        video_providers: cleanVideoProviders,
        bulk_agreements: cleanBulkAgreements,
        roe_detected: p2.roe_detected,
        roe_providers: p2.roe_providers,
        roe_expiry_year: p2.roe_expiry_year,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        _fcc_verified: p2.fcc_providers.length > 0,
        _fcc_providers: p2.fcc_providers,
        proptech: {
          gate_operators: normStrArr(p3.proptech.gate_operators.length ? p3.proptech.gate_operators : rawData.proptech?.gate_operators),
          access_control: normStrArr(p3.proptech.access_control.length ? p3.proptech.access_control : rawData.proptech?.access_control),
          intercoms: normStrArr(p3.proptech.intercoms.length ? p3.proptech.intercoms : rawData.proptech?.intercoms),
          cameras: normStrArr(p3.proptech.cameras.length ? p3.proptech.cameras : rawData.proptech?.cameras),
          smart_locks: normStrArr(p3.proptech.smart_locks.length ? p3.proptech.smart_locks : rawData.proptech?.smart_locks),
          resident_apps: normStrArr(p3.proptech.resident_apps.length ? p3.proptech.resident_apps : rawData.proptech?.resident_apps),
          package_solutions: normStrArr(p3.proptech.package_solutions.length ? p3.proptech.package_solutions : rawData.proptech?.package_solutions),
          tech_generation: normStr(p3.proptech.tech_generation ?? rawData.proptech?.tech_generation) ?? 'legacy',
          sara_signals: rawData.proptech?.sara_signals ?? false,
          replacement_window: normStr(rawData.proptech?.replacement_window),
          displacement_targets: normStrArr(rawData.proptech?.displacement_targets),
        },
      },
      decision_maker: {
        name: normStr(bestContact?.name || fallback.name) ?? null,
        title: normStr(bestContact?.title || fallback.title) ?? null,
        company: normStr(bestContact?.company || fallback.company) ?? mgmt ?? '',
        email: normStr(bestContact?.email || fallback.email) ?? '',
        // Phone hierarchy: Apollo direct line → leasing office (labelled) → empty
        phone: normStr(bestContact?.phone) ?? (officePhone ?? ''),
        phone_source: (normStr(bestContact?.phone) ? 'direct' : (officePhone ? 'office_main' : null)) as 'direct' | 'office_main' | null,
        gatekeeper_tip: gatekeeperTipResult ?? null,
        tenure_years: 0,
        top_email_format: p3.email_format || '',
        linkedin_slug: normStr(bestContact?.linkedin?.split('/in/')?.[1] || fallback.linkedin_slug) ?? '',
      },
      decision_maker_chain: mergedDMChain.length > 0 ? mergedDMChain
        : (rawData.extracted_contacts || []).filter((c: any) => normStr(c.name)).map((c: any) => {
            const directPhone = normStr(c.phone)
            return {
              name: normStr(c.name) ?? '', title: normStr(c.title) ?? '', company: normStr(c.company) ?? '',
              role_type: 'unknown', email: normStr(c.email) ?? '', top_email_format: '',
              phone: directPhone ?? (officePhone ?? ''),
              phone_source: (directPhone ? 'direct' : (officePhone ? 'office_main' : null)) as 'direct' | 'office_main' | null,
              gatekeeper_tip: null as string | null,
              linkedin_slug: normStr(c.linkedin_slug) ?? '',
            }
          }),
      ownership: {
        owner_entity: normStr(finalOwner || rawData.ownership?.owner_entity),
        owner_type: normStr(p2.owner_type || rawData.ownership?.owner_type),
        portfolio_size: normStr(rawData.ownership?.portfolio_size),
        acquisition_year: normStr(p2.acquisition_year || rawData.ownership?.acquisition_year),
        sale_price: null,
        capex_signal: normStr(rawData.ownership?.capex_signal),
      },
      pain_signals: p3.pain_signals.length > 0 ? p3.pain_signals : (rawData.pain_signals ?? []),
      profile: {
        buy_score: rawData.freshness_score ? Math.round(rawData.freshness_score * 1.0 + 0) : 5,
        urgency: p3.pain_signals.filter(s => s.type === 'gate').length > 2 || p2.bulk_detected ? 'high' : 'medium',
        primary_concern: normStr(rawData.key_finding?.slice(0, 300)) ?? 'No critical vulnerabilities detected',
        current_vendor: normStr((cleanBulkAgreements[0] as any)?.provider ?? cleanIspProviders[0] ?? p2.roe_providers[0]),
        contract_window: p2.roe_expiry_year
          ? `ROE expires ${p2.roe_expiry_year}`
          : normStr((cleanBulkAgreements[0] as any)?.expiry_estimate),
        communication_style: normStr(rawData.behavioral_profile?.communication_pref) ?? 'Email',
      },
      behavioral_profile: rawData.behavioral_profile ?? null,
      pitch_strategy: rawData.pitch_strategy ?? null,
      freshness_score: rawData.freshness_score ?? 5,
      buying_trends: normStr(rawData.buying_trends),
      scout_brief: {
        primary_contact: normStr(bestContact?.name) ?? mgmt ?? property_name,
        outreach_angle: p2.bulk_detected ? 'contract_window' : 'tech_displacement',
        contract_window_urgency: p2.bulk_detected ? 'high' : 'medium',
        key_data_points: rawData.key_finding ? [rawData.key_finding] : [],
      },
      scout_queue: scoutQueue,
    }

    // ── Save to aria_searches ─────────────────────────────────────────────────
    let savedSearchId: string | undefined
    try {
      const portalUser = await getCurrentUser()
      const originalQuery = raw.property_name || raw.query || rawQuery
      const { data: searchRow } = await supabaseDeep.from('aria_searches').insert({
        query: originalQuery,
        query_interpretation: `ARIA ${ARIA_ENGINE_VERSION} — ${property_name}`,
        results: { mode: 'deep', engine_version: ARIA_ENGINE_VERSION, prospects: [prospectPayload], fccVerified: p2.fcc_providers.length > 0, webIntelligence: true },
        search_type: 'deep', user_id: userId,
        user_name: portalUser.name, user_email: portalUser.email,
        org_id: portalUser.org_id ?? null,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }).select('id').single()
      if (searchRow?.id) savedSearchId = searchRow.id
    } catch { }

    // ── Persist detections (non-blocking) ─────────────────────────────────────
    void (async () => {
      try {
        const { data: allProviders } = await supabaseDeep.from('mdu_providers').select('id, name').eq('active', true)
        if (!allProviders) return
        const rows = cleanBulkAgreements
          .filter((a: any) => ['high', 'confirmed', 'medium'].includes(a.confidence ?? ''))
          .map((a: any) => {
            const provName = (a.provider ?? '').toLowerCase()
            const matched = (allProviders as any[]).find(p => p.name.toLowerCase().includes(provName) || provName.includes(p.name.toLowerCase()))
            if (!matched) return null
            const yearMatch = (a.expiry_estimate ?? '').match(/20\d{2}/)
            return {
              provider_id: matched.id,
              property_name: property_name || null,
              property_address: address || null,
              confidence: a.confidence === 'high' ? 'high' : 'medium',
              source_type: 'aria',
              source_snippet: (a.evidence as string)?.slice(0, 250) ?? null,
              contract_end_year: yearMatch ? parseInt(yearMatch[0], 10) : null,
              verified_by: 'aria',
            }
          }).filter(Boolean)
        if (rows.length > 0) await supabaseDeep.from('mdu_provider_detections').upsert(rows, { onConflict: 'provider_id,property_name', ignoreDuplicates: false })
      } catch { }
    })()

    // ── Persist to Intel DB (non-blocking) ────────────────────────────────────
    void (async () => {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/aria/properties`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prospects: [prospectPayload] }),
        })
      } catch { }
    })()

    // Suppress unused warning for contractExpiryYear (used in non-blocking write)
    void contractExpiryYear

    return NextResponse.json({
      type: 'property',
      mode: 'deep',
      engine_version: ARIA_ENGINE_VERSION,
      query_interpretation: `ARIA ${ARIA_ENGINE_VERSION} — ${property_name}`,
      prospects: [prospectPayload],
      savedSearchId,
      sources: p3.raw_excerpts.filter(r => r.url && r.score > 0.3).slice(0, 8).map(r => ({
        title: r.title, url: r.url, excerpt: r.content.slice(0, 200), score: r.score, type: r.source ?? 'web',
      })),
      intelligence_sources: {
        fcc: p2.fcc_providers.length > 0,
        resident_reviews: p3.raw_excerpts.length > 0,
        apollo: p3.contacts.length > 0,
        ninjapear_verified: p3.contacts.some(c => c.verified),
        serper_active: !!process.env.SERPER_API_KEY,
      },
      fccVerified: p2.fcc_providers.length > 0,
      webIntelligence: true,
    })

  } catch (err: any) {
    console.error('[aria/research/deep]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
