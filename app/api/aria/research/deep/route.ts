/**
 * POST /api/aria/research/deep
 *
 * ARIA Sales Intelligence Engine v2 — Sales Rep Workflow Architecture
 * 7 sequential steps modeled on how a great sales rep researches a property.
 *
 * Step 1: Identity   — unit count, address, mgmt company, geocode (~4s, 2 searches)
 * Step 2: Ownership  — owner entity, acquisition, old name detection (~4s, 2 searches)
 * Step 3: Pain       — reviews, Reddit, social (current + old name) (~5s, 4 searches)
 * Step 4: ISP        — FCC API + DB portfolio + targeted ISP searches (~4s, 2 searches)
 * Step 4B: ISP Conf  — if bulk detected but provider unknown (~3s, 2 searches, conditional)
 * Step 5: PropTech   — gate/access/camera brands (~4s, 3 searches)
 * Step 6: People     — PM + Regional + Asset Manager; 6 parallel sources; email construction (~8s)
 * Step 7: Synthesis  — Sonnet assembles into structured output (~8s)
 *
 * Total: ~32-42s | ~16 searches (Tavily + Serper) | ~$0.52/search
 * Parallelism: Steps 3+4+5+6 run concurrently — saves ~8s vs sequential Step 6
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

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// Version: Year.MonthRevision — increment revision on each engine change this month
const ARIA_ENGINE_VERSION = 'v6.56'

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

async function tavilySearch(query: string, maxResults = 4, source = 'web', depth: 'basic' | 'advanced' = 'basic', rawContent = false): Promise<TavilyResult[]> {
  if (!process.env.TAVILY_API_KEY) return []
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.TAVILY_API_KEY}` },
      body: JSON.stringify({ query, search_depth: depth, max_results: maxResults, include_answer: false, include_raw_content: rawContent, include_images: false }),
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.results ?? []).map((r: TavilyResult) => ({ ...r, source }))
  } catch { return [] }
}

// ─── Serper (Google Search API) ──────────────────────────────────────────────
// Used where Google's index beats Tavily: LinkedIn, press releases, social pages

async function serperSearch(query: string, maxResults = 5, source = 'serper', type: 'search' | 'news' = 'search'): Promise<TavilyResult[]> {
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
    // Normalize Serper results to TavilyResult shape
    const items = type === 'news' ? (data.news ?? []) : (data.organic ?? [])
    return items.slice(0, maxResults).map((r: any) => ({
      title:   r.title ?? '',
      url:     r.link ?? '',
      content: [r.snippet, r.date].filter(Boolean).join(' — '),
      score:   0.8,
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
      { headers: { 'User-Agent': 'GateGuard-ARIA/2.0 (rfeldman@gateguard.co)' }, signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.[0]) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch { return null }
}

// ─── FCC Broadband Map API (free) ─────────────────────────────────────────────
// NOTE: GET /listAvailability returns 405 as of 2025 — API requires POST with JSON body

async function fccBroadbandLookup(lat: number, lng: number): Promise<string[]> {
  try {
    // Try POST first (current FCC BDC API format)
    const postRes = await fetch(
      'https://broadbandmap.fcc.gov/api/public/map/listAvailability',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'GateGuard-ARIA/2.0' },
        body: JSON.stringify({ latitude: parseFloat(lat.toFixed(6)), longitude: parseFloat(lng.toFixed(6)), unit: 'location', limit_to_isp: 'N' }),
        signal: AbortSignal.timeout(6000),
      }
    )
    if (postRes.ok) {
      const data = await postRes.json()
      const providers: Array<{ brand_name: string; technology: string }> = data?.results ?? data?.availability ?? data?.data ?? []
      const names = [...new Set(providers.filter(p => p.technology && !['60','70','300','400'].includes(String(p.technology))).map(p => p.brand_name).filter(Boolean))]
      if (names.length > 0) return names
    }
    // Fallback: try GET with query params (original format, in case it comes back)
    const getRes = await fetch(
      `https://broadbandmap.fcc.gov/api/public/map/listAvailability?latitude=${lat.toFixed(6)}&longitude=${lng.toFixed(6)}&unit=location`,
      { headers: { 'User-Agent': 'GateGuard-ARIA/2.0' }, signal: AbortSignal.timeout(5000) }
    )
    if (!getRes.ok) return []
    const data2 = await getRes.json()
    const providers2: Array<{ brand_name: string; technology: string }> = data2?.results ?? data2?.availability ?? []
    return [...new Set(providers2.filter(p => p.technology && !['60','70','300','400'].includes(String(p.technology))).map(p => p.brand_name).filter(Boolean))]
  } catch { return [] }
}

// ─── EDGAR ────────────────────────────────────────────────────────────────────

interface EdgarResult { title: string; url: string; content: string; score: number; source: string }

async function searchEdgar(propertyName: string, managementCompany: string): Promise<EdgarResult[]> {
  const queries = [
    `"${propertyName}" "bulk internet" OR "MDU agreement" OR "exclusive internet" OR "bulk broadband"`,
    managementCompany ? `"${managementCompany}" MDU internet "exclusive" OR "bulk agreement"` : null,
  ].filter(Boolean) as string[]
  const results: EdgarResult[] = []
  for (const q of queries) {
    try {
      const url = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(q)}&forms=10-K%2C10-Q%2C8-K&dateRange=custom&startdt=2019-01-01`
      const res = await fetch(url, { headers: { 'User-Agent': 'GateGuard-ARIA/2.0' }, signal: AbortSignal.timeout(8000) })
      if (!res.ok) continue
      const data = await res.json()
      for (const hit of (data?.hits?.hits ?? []).slice(0, 3)) {
        const highlights: string[] = hit.highlight?.file_contents ?? []
        if (!highlights.length) continue
        results.push({
          title: `${hit._source?.entity_name ?? 'Unknown'} — ${hit._source?.form_type ?? 'SEC'} (${hit._source?.file_date ?? ''})`,
          url: `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(q)}&forms=10-K`,
          content: highlights.slice(0, 2).map((h: string) => h.replace(/<\/?em>/g, '**')).join(' ... '),
          score: 0.75, source: 'EDGAR',
        })
      }
    } catch { }
  }
  return results
}

// ─── Apollo ───────────────────────────────────────────────────────────────────

interface ApolloEnrichment { name?: string; title?: string; email?: string; phone_numbers?: string[]; linkedin_url?: string; organization?: { name?: string } }

async function apolloSearchContacts(company: string, titles: string[], location?: string): Promise<ApolloEnrichment[]> {
  if (!process.env.APOLLO_API_KEY) return []
  const key = process.env.APOLLO_API_KEY
  // Apollo changed auth in 2024: try Bearer first, fall back to X-Api-Key
  const tryApollo = async (authHeader: Record<string, string>) => {
    try {
      const res = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ q_organization_name: company, person_titles: titles, person_locations: location ? [location] : [], per_page: 8 }),
        signal: AbortSignal.timeout(8000),
      })
      if (res.status === 403 || res.status === 401) return null
      if (!res.ok) return []
      const data = await res.json()
      return (data?.people ?? []).slice(0, 8) as ApolloEnrichment[]
    } catch { return null }
  }
  // Try Bearer token (new format)
  const bearerResult = await tryApollo({ 'Authorization': `Bearer ${key}` })
  if (bearerResult !== null) return bearerResult
  // Fall back to X-Api-Key (old format)
  const legacyResult = await tryApollo({ 'X-Api-Key': key })
  return legacyResult ?? []
}

// ─── ProxyCurl (1 call max) ───────────────────────────────────────────────────

interface ProxycurlProfile { full_name?: string; occupation?: string; experiences?: Array<{ company?: string; title?: string; ends_at?: any }>; email?: string; personal_email?: string }

async function proxycurlProfile(linkedinUrl: string): Promise<ProxycurlProfile | null> {
  if (!process.env.PROXYCURL_API_KEY) return null
  try {
    const params = new URLSearchParams({ url: linkedinUrl, use_cache: 'if-recent', fallback_to_cache: 'on-error', skills: 'exclude', inferred_salary: 'exclude' })
    const res = await fetch(`https://nubela.co/proxycurl/api/v2/linkedin?${params}`, { headers: { Authorization: `Bearer ${process.env.PROXYCURL_API_KEY}` }, signal: AbortSignal.timeout(4000) })
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

// ─── STEP 0: Bootstrap ────────────────────────────────────────────────────────
// Single broad Serper search BEFORE any targeted searches.
// Finds: official website, press releases, owner announcements → confirms city/state/units/year_built
// Critical: if Step 0 returns a city/state, that overrides all geo hints (prevents Atlanta vs Charleston errors)

interface StepBootstrap {
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
}

async function runStep0(query: string, client: Anthropic): Promise<StepBootstrap> {
  const blank: StepBootstrap = {
    confirmed_name: null, confirmed_address: null, confirmed_city: null, confirmed_state: null,
    confirmed_units: null, confirmed_year_built: null, confirmed_management: null,
    confirmed_owner: null, confirmed_website: null, confirmed_phone: null, is_specific_property: false,
  }

  // Two parallel Serper searches: (1) broad web with QUOTED name, (2) news/press releases
  // Quoted name is critical — unquoted lets Serper drift to unrelated properties
  // Press releases are the most reliable source for units + year built + owner entity
  const [results, newsResults] = await Promise.all([
    serperSearch(
      `"${query}" apartments units address "year built" ownership management contact phone`,
      7, 'bootstrap'
    ),
    serperSearch(
      `"${query}" apartments "units" OR "apartment homes" completed OR opened OR acquired OR developed`,
      4, 'bootstrap-news', 'news'
    ),
  ])
  const allResults = [...results, ...newsResults]
  if (allResults.length === 0) return blank

  const snippets = allResults.map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`).join('\n\n---\n\n')

  const extracted = await haikusExtract<StepBootstrap>(
    `Extract property facts. Return ONLY valid JSON:
{"confirmed_name":null,"confirmed_address":null,"confirmed_city":null,"confirmed_state":null,"confirmed_units":null,"confirmed_year_built":null,"confirmed_management":null,"confirmed_owner":null,"confirmed_website":null,"confirmed_phone":null,"is_specific_property":false}
RULES:
- confirmed_name: exact property/community name found in results (not the query, the real name)
- confirmed_address: full street address (number + street + city + state + zip) if found
- confirmed_city + confirmed_state: REQUIRED — extract from address or any location mention — NEVER guess
- confirmed_units: scan DEEPLY for patterns — "312 apartment homes", "312-unit", "312 units", "312 homes", "Total Units: 312" — integer ONLY — do NOT leave null if ANY unit count appears ANYWHERE
- confirmed_year_built: 4-digit year from "built in YYYY", "Year Built: YYYY", "constructed YYYY", "opened YYYY", "completed YYYY", "delivered YYYY"
- confirmed_management: the company that MANAGES DAY-TO-DAY operations (leasing, maintenance) — look for "managed by", "property management", "operated by" — NOT the developer or owner/investment firm
- confirmed_owner: the INVESTOR, DEVELOPER, or OWNER entity that built or bought the property — look for "developed by", "owned by", "acquired by", "partnership", REIT names, private equity firm names, LLC names. IMPORTANT: If the developer name is in the property name (e.g. "Northland Wharf 7" → Northland is the developer/owner) set confirmed_owner = that company
- confirmed_website: official property website URL (not apartments.com/zillow/yelp)
- confirmed_phone: leasing office or main contact phone number — extract from contact info, Google Business listing snippet, or "call us at" mentions
- is_specific_property: true if results clearly identify ONE specific named property
- null for ANYTHING genuinely not found — never guess city/state`,
    snippets, 800, client
  )

  return extracted || blank
}

// ─── Step interfaces ──────────────────────────────────────────────────────────

interface StepIdentity {
  name: string; address: string; city: string; state: string
  units: number | null; year_built: number | null
  property_class: string | null; property_type: string
  website: string; phone: string; email: string; email_domain: string
  management_company: string; isp_hints: string[]
  coords: { lat: number; lng: number } | null
}
interface StepOwnership {
  owner_entity: string; owner_type: string
  acquisition_year: string; sale_price: string
  portfolio_size: string; old_name: string
}
interface PainSignal {
  type: 'gate' | 'internet' | 'camera' | 'crime' | 'management' | 'smart_lock' | 'general'
  quote: string; source: string; date: string; severity: 'high' | 'medium' | 'low'
}
interface StepPainSignals { signals: PainSignal[]; gate_issue_count: number; internet_issue_count: number; raw_excerpts: TavilyResult[] }
interface StepConnectivity {
  isp_providers: string[]; video_providers: string[]
  bulk_agreements: Array<{ provider: string; service_type: string; agreement_type: string; confidence: string; evidence: string; expiry_estimate?: string }>
  mandatory_tech_fee: boolean; fcc_providers: string[]
  bulk_detected: boolean; provider_confirmed: boolean
}
interface StepPropTech {
  gate_operators: string[]; access_control: string[]
  intercoms: string[]; cameras: string[]
  smart_locks: string[]; resident_apps: string[]
  package_solutions: string[]
  tech_generation: string
}
interface StepContact { name: string; title: string; company: string; role_type: string; email: string; phone: string; linkedin: string }
interface StepPeople {
  property_manager: StepContact | null; regional_manager: StepContact | null
  asset_manager: StepContact | null; all_contacts: StepContact[]; email_format: string
}

// ─── STEP 1: Identity ─────────────────────────────────────────────────────────

async function runStep1(name: string, hintCity: string, hintState: string, hintMgmt: string, hintAddress: string, hintWebsite: string, client: Anthropic): Promise<StepIdentity> {
  const blank: StepIdentity = {
    name, address: hintAddress, city: hintCity, state: hintState, units: null, year_built: null,
    property_class: null, property_type: 'multifamily', website: hintWebsite, phone: '', email: '',
    email_domain: '', management_company: hintMgmt, isp_hints: [], coords: null,
  }
  const geo = [hintCity, hintState].filter(Boolean).join(', ')

  const [listingResults, unitResults, websiteResults, contactResults] = await Promise.all([
    // Listing sites — advanced depth + raw content for unit tables
    tavilySearch(`"${name}" ${geo} apartments site:apartments.com OR site:rentcafe.com OR site:zillow.com OR site:apartmentlist.com OR site:forrent.com`, 3, 'identity', 'advanced', true),
    // Broad search — no site restriction — finds official site + press releases
    tavilySearch(`"${name}" ${geo} apartments "unit" OR "units" OR "homes" "year built" OR "built" floor plans occupancy`, 3, 'identity', 'advanced', true),
    // Official website + owner/mgmt press releases — no site restriction
    hintWebsite
      ? tavilySearch(`site:${hintWebsite.replace(/^https?:\/\//, '').replace(/\/.*/, '')} units "year built" floor plans amenities`, 3, 'identity', 'basic', true)
      : tavilySearch(`"${name}" ${geo} official site OR "property website" OR "leasing" units "year built" amenities technology`, 3, 'identity', 'basic', true),
    tavilySearch(`"${name}" ${geo} leasing office phone contact management company`, 2, 'identity'),
  ])
  const allResults = [...listingResults, ...unitResults, ...websiteResults, ...contactResults]
  const usable = allResults.filter(r => (r.raw_content || r.content)?.length > 40).slice(0, 10)
  if (usable.length === 0) return blank

  const snippets = usable.map((r, i) => {
    const text = r.raw_content ? r.raw_content.slice(0, 2000) : r.content.slice(0, 500)
    return `[${i + 1}] ${r.title}\nURL: ${r.url}\n${text}`
  }).join('\n\n---\n\n')

  const prompt = `Extract property facts. Return ONLY valid JSON:
{"name":"","address":"","city":"","state":"","units":null,"year_built":null,"property_class":null,"property_type":"multifamily","website":"","phone":"","email":"","email_domain":"","management_company":"","isp_hints":[]}
RULES:
- units: integer ONLY — scan deeply for patterns like "312 apartment homes", "312 units", "312 homes", "Total Units: 312", "312-unit" — do NOT return null if ANY number of units appears ANYWHERE in the text
- year_built: 4-digit integer — look for "built in YYYY", "Year Built: YYYY", "constructed YYYY", "opened YYYY"
- property_class: "A","B", or "C" only — look for "Class A", "Class B", luxury/premium=A, standard=B, affordable=C
- website: official property URL (not apartments.com/zillow/rentcafe) — look for the community's own domain
- phone: extract ANY phone number format — "+1 833-571-2103", "(803) 866-6906", "Phone Number+1..." — the leasing office or main contact number
- email_domain: extract domain from any email or official website found
- management_company: ONLY if explicitly named as manager/operator — NOT the property name itself
- isp_hints: any internet provider named as included amenity or "internet included"
- null for unknown numbers, empty string for unknown text`

  const extracted = await haikusExtract<Omit<StepIdentity, 'coords'>>(prompt, snippets, 500, client)
  if (!extracted) return blank

  const addrForGeo = normStr(extracted.address) || name
  const coords = await geocodeAddress(addrForGeo, normStr(extracted.city) || hintCity, normStr(extracted.state) || hintState)

  return {
    name:               normStr(extracted.name) || name,
    address:            normStr(extracted.address) || '',
    city:               normStr(extracted.city) || hintCity,
    state:              normStr(extracted.state) || hintState,
    units:              normInt(extracted.units),
    year_built:         normInt(extracted.year_built),
    property_class:     normStr(extracted.property_class),
    property_type:      normStr(extracted.property_type) || 'multifamily',
    website:            normStr(extracted.website) || '',
    phone:              normStr(extracted.phone) || '',
    email:              normStr(extracted.email) || '',
    email_domain:       normStr(extracted.email_domain) || '',
    management_company: normStr(extracted.management_company) || hintMgmt,
    isp_hints:          normStrArr(extracted.isp_hints),
    coords,
  }
}

// ─── STEP 2: Ownership ────────────────────────────────────────────────────────

async function runStep2(name: string, address: string, city: string, state: string, client: Anthropic): Promise<StepOwnership> {
  const blank: StepOwnership = { owner_entity: '', owner_type: '', acquisition_year: '', sale_price: '', portfolio_size: '', old_name: '' }
  const geo = [city, state].filter(Boolean).join(', ')

  const [ownerResults, oldNameResults, edgarResults] = await Promise.all([
    tavilySearch(`"${address || name}" ${geo} sold acquired purchased ownership "private equity" OR "REIT" OR "investment" apartment`, 4, 'ownership'),
    tavilySearch(`"${name}" ${geo} "formerly known as" OR "previously" OR "renamed" OR "rebranded" apartment`, 3, 'ownership'),
    searchEdgar(name, '').then(r => r.map(e => ({ ...e, source: 'EDGAR' } as TavilyResult))),
  ])

  const allResults = [...ownerResults, ...oldNameResults, ...edgarResults]
  const usable = allResults.filter(r => r.content?.length > 40).slice(0, 10)
  if (usable.length === 0) return blank

  const snippets = usable.map((r, i) => `[${i + 1}] ${r.title}\n${r.content.slice(0, 400)}`).join('\n\n---\n\n')
  const extracted = await haikusExtract<StepOwnership>(
    `Extract ownership and prior name data. Return ONLY valid JSON:
{"owner_entity":"","owner_type":"","acquisition_year":"","sale_price":"","portfolio_size":"","old_name":""}
owner_type: "private_equity","reit","family_office","institutional","local", or ""
old_name: PREVIOUS property name if the property was renamed (look for "formerly","previously known as","rebranded from")
Empty string for anything not found.`,
    snippets, 400, client
  )
  return extracted || blank
}

// ─── STEP 3: Pain Signals ─────────────────────────────────────────────────────

async function runStep3(name: string, oldName: string, city: string, state: string, client: Anthropic): Promise<StepPainSignals> {
  const blank: StepPainSignals = { signals: [], gate_issue_count: 0, internet_issue_count: 0, raw_excerpts: [] }
  const geo = [city, state].filter(Boolean).join(', ')
  const nameQ = [name, oldName].filter(Boolean).map(n => `"${n}"`).join(' OR ')

  const [reviewResults, redditResults, internetResults, gateResults, socialResults] = await Promise.all([
    tavilySearch(`${nameQ} ${geo} reviews internet wifi gate access problems site:apartmentratings.com OR site:apartments.com OR site:yelp.com`, 4, 'pain', 'advanced'),
    // Reddit via Serper: Google indexes Reddit far better than Tavily for apartment-specific complaints
    serperSearch(`${nameQ} ${geo} site:reddit.com internet OR wifi OR gate OR crime OR "break in" OR "broken into"`, 5, 'reddit-pain'),
    tavilySearch(`${nameQ} ${geo} "no choice" OR "forced" OR "mandatory" OR "only option" internet wifi provider`, 3, 'pain', 'advanced'),
    tavilySearch(`${nameQ} ${geo} "gate broken" OR "gate down" OR "gate not working" OR "break-in" OR "broken into" OR "car break"`, 3, 'pain'),
    // Social: events, announcements, upgrades — not just complaints
    serperSearch(`"${nameQ.replace(/"/g, '')}" ${geo} site:facebook.com OR site:instagram.com OR site:nextdoor.com`, 4, 'social-events'),
  ])

  const allResults = [...reviewResults, ...redditResults, ...internetResults, ...gateResults, ...socialResults]
  const usable = allResults.filter(r => r.content?.length > 60).slice(0, 14)
  if (usable.length === 0) return { ...blank, raw_excerpts: allResults }

  const snippets = usable.map((r, i) => `[${i + 1}] ${r.title}\n${r.content.slice(0, 400)}`).join('\n\n---\n\n')
  const extracted = await haikusExtract<Omit<StepPainSignals, 'raw_excerpts'>>(
    `Extract resident pain signals AND social announcements. Return ONLY valid JSON:
{"signals":[{"type":"gate","quote":"","source":"","date":"","severity":"high"}],"gate_issue_count":0,"internet_issue_count":0}
type options: "gate","internet","camera","crime","management","smart_lock","general"
quote: verbatim (max 150 chars).
severity: high=safety/major failure or recent announcement of upgrade, medium=recurring issue or planned change, low=minor complaint.
Include up to 14 signals. Prefer last 12 months. Include BOTH:
1. Negative signals: complaints, failures, "broken gate", "wifi terrible", "only option", forced service
2. Positive signals (type="general"): social posts about upgrades, "new gate", "new cameras", "ButterflyMX installed", tech announcements`,
    snippets, 800, client
  )
  return { ...(extracted || blank), raw_excerpts: allResults }
}

// ─── Known MDU-only ISPs (detecting any of these = auto-flag bulk_detected) ───
// These providers exclusively serve bulk/exclusive MDU deals — no retail residential

const KNOWN_MDU_BULK_ISPS = new Set([
  'gigstreem', 'hotwire', 'pavlov media', 'mdu communications', 'wired broadband',
  'all west', 'bel-fuse', 'broadstripe', 'sonic mdu', 'xenon networks',
  'apogee', 'limecom', 'gig-e', 'pocketinet', 'skybridge',
  'bulk solutions', 'enterprise network services', 'smartabase',
])

// ─── STEP 4: Connectivity ─────────────────────────────────────────────────────

async function runStep4(
  name: string, oldName: string, city: string, state: string,
  mgmt: string, owner: string,
  coords: { lat: number; lng: number } | null,
  portfolioIspBlock: string, cachedDetections: string, priorFindings: string,
  client: Anthropic
): Promise<StepConnectivity> {
  const blank: StepConnectivity = { isp_providers: [], video_providers: [], bulk_agreements: [], mandatory_tech_fee: false, fcc_providers: [], bulk_detected: false, provider_confirmed: false }
  const geo = [city, state].filter(Boolean).join(', ')
  const entity = mgmt || owner
  const nameQ = [name, oldName].filter(Boolean).map(n => `"${n}"`).join(' OR ')

  const fccProviders = coords ? await fccBroadbandLookup(coords.lat, coords.lng) : []

  // Auto-detect known MDU-only ISPs from FCC results → auto-flag bulk even before web search
  const fccLower = fccProviders.map(p => p.toLowerCase())
  const knownMduInFcc = fccLower.some(p => [...KNOWN_MDU_BULK_ISPS].some(mdu => p.includes(mdu)))

  const [bulkResults, ispResults, videoResults, pressReleaseResults, edgarResults] = await Promise.all([
    tavilySearch(`${nameQ} ${geo} "internet included" OR "bulk internet" OR "wifi included" OR "technology fee" OR "mandatory wifi" site:apartments.com OR site:rentcafe.com`, 3, 'isp', 'advanced'),
    tavilySearch(`${nameQ} ${geo} ${fccProviders.slice(0, 3).join(' OR ') || 'Comcast OR Spectrum OR "AT&T" OR Gigstreem OR Hotwire'} internet agreement OR provider`, 4, 'isp'),
    tavilySearch(`${nameQ} ${geo} cable TV OR DirecTV OR "DIRECTV" OR "Dish Network" OR Xfinity OR "Spectrum TV" OR "AT&T TV" OR "Sling" television video`, 3, 'video'),
    // Serper → Google indexes PRNewswire/BusinessWire MDU deal announcements better than Tavily
    entity ? serperSearch(`"${entity}" "bulk internet" OR "MDU" OR "fiber" OR "internet included" OR "broadband" apartment deal announcement`, 5, 'serper-press', 'news') : Promise.resolve([] as TavilyResult[]),
    searchEdgar(name, entity).then(r => r.map(e => ({ ...e, source: 'EDGAR' } as TavilyResult))),
  ])

  const allResults = [...bulkResults, ...ispResults, ...videoResults, ...pressReleaseResults, ...edgarResults]
  const usable = allResults.filter(r => r.content?.length > 40).slice(0, 12)

  const portfolioCtx  = portfolioIspBlock  ? `\n\nPORTFOLIO ISP DB (high confidence):\n${portfolioIspBlock}` : ''
  const cacheCtx      = cachedDetections   ? `\n\nCACHED DETECTIONS:\n${cachedDetections}` : ''
  const findingsCtx   = priorFindings      ? `\n\nPRIOR FINDINGS:\n${priorFindings}` : ''
  const fccCtx        = fccProviders.length > 0 ? `\n\nFCC BROADBAND MAP (confirmed at address):\n${fccProviders.map(p => `• ${p}`).join('\n')}` : ''

  const snippets = usable.map((r, i) => `[${i + 1}] ${r.title}\n${r.content.slice(0, 400)}`).join('\n\n---\n\n')
  const extracted = usable.length > 0 ? await haikusExtract<StepConnectivity>(
    `Extract internet AND video connectivity data. Return ONLY valid JSON:
{"isp_providers":[],"video_providers":[],"bulk_agreements":[],"mandatory_tech_fee":false,"fcc_providers":[],"bulk_detected":false,"provider_confirmed":false}
bulk_agreements: [{"provider":"","service_type":"internet","agreement_type":"bulk","confidence":"high","evidence":"","expiry_estimate":""}]
RULES:
- isp_providers = ONLY actual ISPs (never management company names)
- video_providers = cable/satellite/IPTV providers (DirecTV, Dish, Xfinity, Spectrum TV, DIRECTV STREAM, etc.)
- bulk_detected=true if internet included in rent OR bulk/exclusive deal found OR technology fee mentioned
- provider_confirmed=true if provider name is explicitly stated
- Add video bulk_agreements too if cable/satellite is included in rent${portfolioCtx}${fccCtx}${cacheCtx}${findingsCtx}`,
    snippets, 600, client
  ) : null

  const result = extracted || blank
  result.fcc_providers = fccProviders
  // Auto-flag bulk if any known MDU-only ISP detected in FCC results
  if (knownMduInFcc) result.bulk_detected = true
  // Promote known MDU ISPs to front of isp_providers list
  if (knownMduInFcc) {
    const knownFccProviders = fccProviders.filter(p => [...KNOWN_MDU_BULK_ISPS].some(mdu => p.toLowerCase().includes(mdu)))
    for (const kp of knownFccProviders.reverse()) {
      if (!result.isp_providers.includes(kp)) result.isp_providers.unshift(kp)
      if (result.bulk_agreements.length === 0) {
        result.bulk_agreements.push({ provider: kp, service_type: 'internet', agreement_type: 'bulk', confidence: 'high', evidence: `FCC map shows ${kp} — MDU-only ISP, exclusive bulk model` })
      }
    }
  }
  return result
}

// ─── STEP 4B: ISP Confirmation (conditional) ──────────────────────────────────

async function runStep4b(
  name: string, mgmt: string, owner: string,
  fccProviders: string[], client: Anthropic
): Promise<{ confirmed_provider: string | null; evidence: string }> {
  const entity = mgmt || owner
  if (!entity) return { confirmed_provider: null, evidence: '' }

  const ispStr = fccProviders.length > 0 ? fccProviders.slice(0, 3).join(' OR ') : 'Spectrum OR Comcast OR "AT&T" OR Hotwire OR Gigstreem'

  const [portfolioResults, testimonialResults] = await Promise.all([
    tavilySearch(`"${entity}" ${ispStr} "internet included" OR "bulk" OR "community solutions" OR MDU multifamily`, 3, 'isp-confirm'),
    tavilySearch(`"${entity}" ${ispStr} testimonial OR "case study" OR partner agreement multifamily broadband`, 3, 'isp-confirm'),
  ])

  const usable = [...portfolioResults, ...testimonialResults].filter(r => r.content?.length > 40).slice(0, 8)
  if (usable.length === 0) return { confirmed_provider: null, evidence: '' }

  const snippets = usable.map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content.slice(0, 400)}`).join('\n\n---\n\n')
  const extracted = await haikusExtract<{ confirmed_provider: string | null; evidence: string }>(
    `"${entity}" has a bulk internet deal — find the confirmed ISP. Return ONLY valid JSON:
{"confirmed_provider":null,"evidence":""}
confirmed_provider: exact ISP name (e.g. "Spectrum","Comcast","AT&T Fiber","Gigstreem") or null
evidence: the key phrase that confirms it (e.g. "Spectrum Community Solutions testimonial featuring ${entity}")`,
    snippets, 200, client
  )
  return extracted || { confirmed_provider: null, evidence: '' }
}

// ─── STEP 5: PropTech ─────────────────────────────────────────────────────────

async function runStep5(
  name: string, location: string, mgmt: string, owner: string,
  painSignals: PainSignal[], client: Anthropic
): Promise<StepPropTech> {
  const blank: StepPropTech = { gate_operators: [], access_control: [], intercoms: [], cameras: [], smart_locks: [], resident_apps: [], package_solutions: [], tech_generation: 'legacy' }
  const entity = mgmt || owner
  const hasGatePain = painSignals.some(s => s.type === 'gate')

  const [gateResults, accessResults, addressResults, packageResults, entityResults, socialResults] = await Promise.all([
    tavilySearch(`"${name}" ${location} ${hasGatePain ? '"gate" "broken" OR "replaced" OR "installed"' : ''} DoorKing OR LiftMaster OR Viking OR Linear OR FAAC OR ButterflyMX OR Aiphone gate intercom access`, 4, 'proptech'),
    tavilySearch(`"${name}" ${location} Brivo OR Openpath OR HID OR SALTO OR Verkada OR Avigilon OR SmartRent OR GateWise OR Latch cameras security "smart lock"`, 4, 'proptech'),
    tavilySearch(`"${name}" ${location} "new" OR "installed" OR "upgraded" OR "replaced" gate OR intercom OR camera OR "access control" OR "smart lock" OR "package locker" 2022 OR 2023 OR 2024 OR 2025`, 3, 'proptech'),
    // Package / EV / smart home — explicit separate search
    tavilySearch(`"${name}" ${location} "package locker" OR "Amazon Hub" OR "package room" OR "parcel pending" OR "package concierge" OR "EV charging" OR "smart home" OR "thermostat" OR "keyless" OR "Latch" OR "August" OR "Yale"`, 3, 'proptech-extra'),
    entity ? tavilySearch(`"${entity}" ButterflyMX OR DoorKing OR SmartRent OR Brivo OR LiftMaster OR Verkada portfolio standard`, 3, 'proptech') : Promise.resolve([] as TavilyResult[]),
    serperSearch(`"${name}" ${location} "new gate" OR "new intercom" OR "ButterflyMX" OR "new cameras" OR "upgraded" OR "smart access" site:facebook.com OR site:instagram.com OR site:nextdoor.com`, 4, 'serper-social'),
  ])

  const usable = [...gateResults, ...accessResults, ...addressResults, ...packageResults, ...entityResults, ...socialResults].filter(r => r.content?.length > 40).slice(0, 16)
  if (usable.length === 0) return blank

  const snippets = usable.map((r, i) => `[${i + 1}] ${r.title}\n${r.content.slice(0, 350)}`).join('\n\n---\n\n')
  const extracted = await haikusExtract<StepPropTech>(
    `Extract ALL property technology brands found. Return ONLY valid JSON:
{"gate_operators":[],"access_control":[],"intercoms":[],"cameras":[],"smart_locks":[],"resident_apps":[],"package_solutions":[],"tech_generation":"legacy"}
Known brands:
- gates: DoorKing/LiftMaster/Viking/Linear/FAAC/PDK/FAAC/Doorbird
- access: Brivo/HID/SALTO/Openpath/PDK/Kisi
- intercoms: ButterflyMX/Aiphone/Viking/2N/Doorbird/Verkada
- cameras: Verkada/Avigilon/EagleEye/Hanwha/Axis/Hikvision/Dahua
- smart_locks: SmartRent/GateWise/Latch/August/Yale/Schlage/Kwikset/igloohome
- resident_apps: SmartRent/Entrata/RealPage/Yardi/AppFolio/Knock/Funnel
- package_solutions: "Parcel Pending"/"Amazon Hub"/"Package Concierge"/"Luxer One"/"Butterfly Package"/"package locker"/"package room"
- Also note: EV charging, smart thermostats, solar if mentioned
tech_generation: "legacy"=pre-2018 hardware, "modern"=2018+ cloud-managed, "hybrid"=mix
Empty arrays for anything not found — never fabricate brand names.`,
    snippets, 400, client
  )
  return extracted || blank
}

// ─── STEP 6: People — Full contact chain (PM / Regional / Asset) ─────────────
// Excellence standard: name + title + email + phone + LinkedIn for each level.
// Sources (in priority order):
//   1. Apollo — best for direct emails + phones at regional/corporate level
//   2. Three targeted Serper LinkedIn searches (one per role tier)
//   3. Official website team/staff page scrape
//   4. Property-level PM contact (Google: property name + "community manager")
//   5. Email format construction (Hunter/RocketReach pattern → build from name + domain)
//   6. ProxyCurl validation on top Apollo contact (1 call max)

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
  return `${f}.${l}@${domain}` // sensible default
}

async function runStep6(
  name: string, city: string, state: string, mgmt: string, owner: string,
  emailDomain: string, confirmedWebsite: string, painRawExcerpts: TavilyResult[], client: Anthropic
): Promise<StepPeople> {
  const blank: StepPeople = { property_manager: null, regional_manager: null, asset_manager: null, all_contacts: [], email_format: '' }
  const entity = mgmt || owner
  if (!entity) return blank
  const geo = [city, state].filter(Boolean).join(', ')
  // Derive domain from confirmed website if emailDomain not provided by Step 1
  const domainForEmail = emailDomain || (confirmedWebsite
    ? confirmedWebsite.replace(/^https?:\/\//, '').replace(/\/.*/, '').replace(/^www\./, '')
    : '')

  const painSnippets = painRawExcerpts.filter(r => r.content?.length > 40).slice(0, 4)
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.content.slice(0, 250)}`).join('\n\n---\n\n')

  // ── Wave 1: All searches fire in parallel ──────────────────────────────────
  const [
    // 1a. Serper LinkedIn — property-level (on-site PM, community manager, leasing)
    liPropertyResults,
    // 1b. Serper LinkedIn — management company level (regional directors, area managers)
    liRegionalResults,
    // 1c. Serper LinkedIn — ownership level (asset managers, VPs, portfolio managers)
    liOwnerResults,
    // 1d. Direct website team/contact page search
    websiteTeamResults,
    // 1e. Property-level PM — Google indexed contact pages, Apartments.com staff bio
    propertyPmResults,
    // 1f. Apollo B2B contacts — best source for direct emails
    apolloContacts,
  ] = await Promise.all([
    serperSearch(
      `"${name}" "${geo}" "community manager" OR "property manager" OR "leasing manager" site:linkedin.com`,
      5, 'li-property'
    ),
    serperSearch(
      `"${entity}" ${geo} "regional manager" OR "regional director" OR "area manager" OR "district manager" site:linkedin.com`,
      5, 'li-regional'
    ),
    serperSearch(
      `"${owner || entity}" "asset manager" OR "portfolio manager" OR "vice president" OR "managing director" site:linkedin.com`,
      4, 'li-owner'
    ),
    confirmedWebsite
      ? tavilySearch(
          `site:${confirmedWebsite.replace(/^https?:\/\//, '').replace(/\/.*/, '')} "contact" OR "team" OR "staff" OR "community manager" OR "leasing"`,
          3, 'website-team', 'basic', true
        )
      : tavilySearch(
          `"${name}" ${geo} site "community manager" OR "property manager" contact staff team`,
          3, 'website-team'
        ),
    tavilySearch(
      `"${name}" ${geo} "community manager" OR "property manager" OR "leasing manager" name phone email contact`,
      3, 'people'
    ),
    apolloSearchContacts(entity, [
      'Property Manager', 'Community Manager', 'Leasing Manager',
      'Regional Property Manager', 'Regional Manager', 'Regional Director', 'Area Manager', 'District Manager',
      'Asset Manager', 'Portfolio Manager', 'Vice President', 'Director of Operations',
      'Chief Executive Officer', 'CEO', 'President', 'Managing Director',
    ], geo),
  ])

  // ── Email format detection (parallel — doesn't block contact discovery) ─────
  const emailFormatP: Promise<string> = (async () => {
    if (!domainForEmail) return ''
    // Serper → Google finds Hunter.io / RocketReach format pages better than Tavily
    const efResults = await serperSearch(
      `"${domainForEmail}" email format site:hunter.io OR site:rocketreach.co OR site:emailformat.com`,
      3, 'email-format'
    )
    // Fall back to Tavily if Serper didn't find it
    const efFallback = efResults.length === 0
      ? await tavilySearch(`"@${domainForEmail}" email "firstname.lastname" OR "first.last" OR "flastname" format`, 2, 'email-format')
      : []
    const efSnippets = [...efResults, ...efFallback]
      .filter(r => r.content?.length > 20).slice(0, 4).map(r => r.content.slice(0, 250)).join('\n')
    if (!efSnippets) return ''
    const efResult = await haikusExtract<{ format: string }>(
      `Find the standard email format used at domain "${domainForEmail}". Return ONLY valid JSON: {"format":""}
Examples of format strings: "firstname.lastname@domain.com", "flastname@domain.com", "firstname@domain.com", "f.lastname@domain.com"
Return empty string if format cannot be determined with confidence.`,
      efSnippets, 80, client)
    return normStr(efResult?.format) || ''
  })()

  // ── Apollo contacts → typed StepContacts ────────────────────────────────────
  const apolloTyped: StepContact[] = apolloContacts.slice(0, 8).map(c => {
    const tl = (c.title ?? '').toLowerCase()
    let role_type = 'corporate'
    if (tl.includes('property manager') || tl.includes('community manager') || tl.includes('leasing')) role_type = 'property_manager'
    else if (tl.includes('regional') || tl.includes('area manager') || tl.includes('district manager')) role_type = 'regional_manager'
    else if (tl.includes('asset') || tl.includes('portfolio') || tl.includes('director') || tl.includes('vice president') || tl.includes('vp') || tl.includes('managing director')) role_type = 'asset_manager'
    return {
      name: normStr(c.name) || '', title: normStr(c.title) || '',
      company: normStr(c.organization?.name) || entity, role_type,
      email: normStr(c.email) || '', phone: normStr(c.phone_numbers?.[0]) || '',
      linkedin: normStr(c.linkedin_url) || '',
    }
  }).filter(c => c.name)

  // ── Extract named contacts from all web snippets ─────────────────────────────
  const webSnippetSources = [
    ...liPropertyResults, ...liRegionalResults, ...liOwnerResults,
    ...websiteTeamResults, ...propertyPmResults,
  ]
  const webSnippets = [
    painSnippets,
    ...webSnippetSources.filter(r => r.content?.length > 40).slice(0, 10)
      .map((r, i) => `[${i + 1}] SOURCE: ${r.source || r.url}\nTITLE: ${r.title}\nURL: ${r.url}\n${r.content.slice(0, 400)}`),
  ].join('\n\n---\n\n')

  const webExtracted = webSnippets.length > 80
    ? await haikusExtract<{ contacts: Array<StepContact & { linkedin_url?: string }> }>(
        `You are a real estate contact intelligence extractor. Extract EVERY named individual from these search results who works for "${entity}" OR at the property "${name}".

Return ONLY valid JSON:
{"contacts":[{"name":"","title":"","company":"","role_type":"property_manager","email":"","phone":"","linkedin":""}]}

EXTRACTION RULES:
- role_type options: "property_manager" (on-site community/leasing manager), "regional_manager" (multi-property regional/area/district director), "asset_manager" (investment/portfolio/VP level), "corporate" (C-suite, president, CEO)
- email: extract any email address found in the snippet — even partial like "jsmith@..."
- phone: extract any phone number (format as-is from source)
- linkedin: extract full LinkedIn URL if present (linkedin.com/in/...)
- Only real human names (First Last format) — no company names, no titles as names
- Include people found on LinkedIn search results even if snippet is brief — URL alone proves they exist
- If LinkedIn URL contains a name slug (e.g. /in/sarah-johnson-pm), extract inferred name "Sarah Johnson" if not already named
- Empty array if ZERO named contacts found`,
        webSnippets, 800, client)
    : null

  const webContacts: StepContact[] = ((webExtracted?.contacts ?? []) as StepContact[])
    .filter(c => normStr(c.name) !== null && c.name.includes(' '))

  // ── Await email format, then construct missing emails ────────────────────────
  const emailFormat = await emailFormatP

  // ── ProxyCurl: validate the best Apollo contact with LinkedIn URL (1 call max) ─
  const topWithLinkedin = apolloTyped.find(c => c.linkedin) || webContacts.find(c => c.linkedin)
  let proxyProfile: ProxycurlProfile | null = null
  if (topWithLinkedin?.linkedin) proxyProfile = await proxycurlProfile(topWithLinkedin.linkedin)

  // ── Merge & deduplicate (Apollo first — most likely to have emails/phones) ───
  const allContacts: StepContact[] = [...apolloTyped, ...webContacts].filter((c, idx, arr) =>
    c.name && arr.findIndex(x => x.name.toLowerCase() === c.name.toLowerCase()) === idx
  )

  // ── Patch ProxyCurl verified data onto matching contact ──────────────────────
  if (proxyProfile && topWithLinkedin) {
    const currentExp = (proxyProfile.experiences ?? []).find(e => !e.ends_at)
    const idx = allContacts.findIndex(c => c.name.toLowerCase() === topWithLinkedin.name.toLowerCase())
    if (idx >= 0) {
      if (proxyProfile.email || proxyProfile.personal_email)
        allContacts[idx].email = proxyProfile.email || proxyProfile.personal_email || allContacts[idx].email
      if (currentExp?.title) allContacts[idx].title = currentExp.title
    }
  }

  // ── Construct best-guess email for contacts still missing one ────────────────
  if (domainForEmail) {
    allContacts.forEach(c => {
      if (!c.email && c.name && c.name.includes(' ')) {
        const parts = c.name.trim().split(/\s+/)
        const first = parts[0], last = parts[parts.length - 1]
        c.email = constructEmail(first, last, domainForEmail, emailFormat)
      }
    })
  }

  return {
    property_manager: allContacts.find(c => c.role_type === 'property_manager') || null,
    regional_manager: allContacts.find(c => c.role_type === 'regional_manager') || null,
    asset_manager:    allContacts.find(c => c.role_type === 'asset_manager') || allContacts.find(c => c.role_type === 'corporate') || null,
    all_contacts: allContacts,
    email_format: emailFormat,
  }
}

// ─── Synthesis tool schema ────────────────────────────────────────────────────

const deepIntelTool: Anthropic.Tool = {
  name: 'aria_deep_intel_result',
  description: 'Return the structured deep connectivity, proptech, and ownership intelligence for this property.',
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
      isp_providers:  { type: 'array', items: { type: 'string' } },
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
        items: {
          type: 'object',
          properties: { name: { type: 'string' }, title: { type: 'string' }, company: { type: 'string' }, email: { type: 'string' }, linkedin_slug: { type: 'string' } },
        },
      },
      key_finding:    { type: 'string' },
      confidence:     { type: 'string', enum: ['high', 'medium', 'low'] },
      units:          { type: 'number' }, year_built: { type: 'number' },
      property_class: { type: 'string', enum: ['A', 'B', 'C'] },
      property_type:  { type: 'string' },
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
          gate_operators:       { type: 'array', items: { type: 'string' } },
          access_control:       { type: 'array', items: { type: 'string' } },
          intercoms:            { type: 'array', items: { type: 'string' } },
          cameras:              { type: 'array', items: { type: 'string' } },
          smart_locks:          { type: 'array', items: { type: 'string' } },
          resident_apps:        { type: 'array', items: { type: 'string' } },
          package_solutions:    { type: 'array', items: { type: 'string' } },
          tech_generation:      { type: 'string', enum: ['legacy', 'modern', 'hybrid'] },
          sara_signals:         { type: 'boolean' },
          replacement_window:   { type: 'string' },
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
        properties: { personality_type: { type: 'string' }, decision_style: { type: 'string' }, risk_tolerance: { type: 'string' }, communication_pref: { type: 'string' } },
      },
      pitch_strategy: {
        type: 'object',
        properties: { primary_hook: { type: 'string' }, avoid_topics: { type: 'array', items: { type: 'string' } }, best_time_to_call: { type: 'string' }, social_proof: { type: 'string' } },
      },
      freshness_score: { type: 'number' },
      buying_trends:   { type: 'string' },
    },
  },
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

    const hintCity  = (raw.city  as string) || ''
    const hintState = (raw.state as string) || ''
    const hintMgmt  = (raw.management_company as string) || ''

    // ── Step 0: Bootstrap (broad Serper — no site restrictions) ──────────────
    // Finds official website, press releases, owner announcements
    // CRITICAL: confirmed city/state from Step 0 overrides all hints — prevents geo errors
    const s0 = await runStep0(rawQuery, anthropic)
    const bootstrapCity    = s0.confirmed_city  || hintCity
    const bootstrapState   = s0.confirmed_state || hintState
    const bootstrapMgmt    = s0.confirmed_management || hintMgmt
    const bootstrapAddress = s0.confirmed_address || (raw.address as string) || ''
    const bootstrapWebsite = s0.confirmed_website || ''

    // ── Step 1: Identity ──────────────────────────────────────────────────────
    const s1 = await runStep1(
      s0.confirmed_name || rawQuery,
      bootstrapCity, bootstrapState, bootstrapMgmt,
      bootstrapAddress, bootstrapWebsite, anthropic
    )

    // Step 0 confirmed data wins over Step 1 inferences for core facts
    const property_name = s0.confirmed_name || s1.name || rawQuery
    const address       = bootstrapAddress   || s1.address || ''
    const city          = bootstrapCity      || s1.city    || ''
    const state         = bootstrapState     || s1.state   || ''
    const mgmt          = s0.confirmed_management || s1.management_company || ''
    const location      = [city, state].filter(Boolean).join(', ') || address || ''

    // Merge Step 0 facts as ground-truth overrides into s1
    if (s0.confirmed_units    && !s1.units)       s1.units       = s0.confirmed_units
    if (s0.confirmed_year_built && !s1.year_built) s1.year_built  = s0.confirmed_year_built
    if (s0.confirmed_phone    && !s1.phone)       s1.phone       = s0.confirmed_phone
    if (s0.confirmed_website  && !s1.website)     s1.website     = s0.confirmed_website

    // ── DB lookups + Step 2 in parallel ──────────────────────────────────────
    let portfolioIspBlock = ''
    let cachedDetectionsBlock = ''
    let priorFindingsBlock = ''

    const [s2] = await Promise.all([
      runStep2(property_name, address, city, state, anthropic),
      Promise.allSettled([
        (async () => {
          if (!mgmt) return
          try {
            const { data } = await supabaseDeep.from('mgmt_isp_portfolio')
              .select('management_company_display, isp_name, agreement_type, coverage_states, coverage_notes, confidence')
              .ilike('management_company', `%${mgmt.split(' ')[0]}%`).eq('active', true)
            if (data?.length) {
              const rel = state ? data.filter((r: any) => !r.coverage_states?.length || r.coverage_states.includes(state.toUpperCase())) : data
              if (rel.length) portfolioIspBlock = rel.map((r: any) => `• ${r.management_company_display} → ${r.isp_name} (${r.agreement_type}) [${r.confidence}]\n  ${r.coverage_notes ?? ''}`).join('\n')
            }
          } catch {}
        })(),
        (async () => {
          try {
            const { data } = await supabaseDeep.from('mdu_provider_detections')
              .select('confidence, source_type, mdu_providers ( name )')
              .ilike('property_name', `%${property_name}%`).in('confidence', ['confirmed', 'high', 'medium']).limit(8)
            if (data?.length) cachedDetectionsBlock = data.map((d: any) => `• ${d.mdu_providers?.name}: ${d.confidence} [${d.source_type}]`).join('\n')
          } catch {}
        })(),
        (async () => {
          try {
            const { data } = await supabaseDeep.from('aria_contract_findings')
              .select('provider_name, agreement_type, service_type, confidence')
              .or(`property_name.ilike.%${property_name}%`).in('confidence', ['confirmed', 'high', 'medium-high'])
              .order('created_at', { ascending: false }).limit(6)
            if (data?.length) priorFindingsBlock = data.map((f: any) => `• ${f.provider_name} — ${f.agreement_type} ${f.service_type} [${f.confidence}]`).join('\n')
          } catch {}
        })(),
      ]),
    ])

    const owner    = normStr(s2.owner_entity) || s0.confirmed_owner || ''
    const old_name = normStr(s2.old_name) || ''

    // ── Steps 3, 4, 5, 6 all in parallel ─────────────────────────────────────
    // Step 6 (People) is independent of Steps 4+5 — runs concurrently, saves ~8s
    const [s3, s4, s5, s6] = await Promise.all([
      runStep3(property_name, old_name, city, state, anthropic),
      runStep4(property_name, old_name, city, state, mgmt, owner, s1.coords, portfolioIspBlock, cachedDetectionsBlock, priorFindingsBlock, anthropic),
      runStep5(property_name, location, mgmt, owner, [], anthropic),
      runStep6(property_name, city, state, mgmt, owner, s1.email_domain, bootstrapWebsite, [], anthropic),
    ])

    // ── Step 4B: ISP Confirmation ─────────────────────────────────────────────
    // Fires when: (a) FCC/web detected bulk deal without named provider, OR
    //             (b) ≥2 internet pain signals + "no choice"/"locked in"/"included" language
    //             → resident complaints are a reliable proxy for MDU bulk internet
    const painBulkSignals = s3.signals.filter(s => s.type === 'internet')
    const painIndicatesBulk = painBulkSignals.length >= 2 ||
      painBulkSignals.some(s => {
        const q = s.quote.toLowerCase()
        return q.includes('no choice') || q.includes('locked') || q.includes('only option') ||
               q.includes('included') || q.includes('no other') || q.includes('monopoly') ||
               q.includes('forced') || q.includes('one provider') || q.includes('not worth')
      })

    if ((s4.bulk_detected || painIndicatesBulk) && !s4.provider_confirmed && (mgmt || owner)) {
      // If pain signals triggered this (not FCC), mark as bulk_detected
      if (painIndicatesBulk && !s4.bulk_detected) {
        s4.bulk_detected = true
      }
      const conf = await runStep4b(property_name, mgmt, owner, s4.fcc_providers, anthropic)
      if (conf.confirmed_provider) {
        if (!s4.isp_providers.includes(conf.confirmed_provider)) s4.isp_providers.unshift(conf.confirmed_provider)
        s4.provider_confirmed = true
        if (s4.bulk_agreements.length === 0) {
          s4.bulk_agreements.push({ provider: conf.confirmed_provider, service_type: 'internet', agreement_type: 'bulk', confidence: painIndicatesBulk ? 'medium' : 'high', evidence: conf.evidence || 'Inferred from resident pain signals: no choice of provider' })
        } else if (!s4.bulk_agreements[0].provider) {
          s4.bulk_agreements[0].provider = conf.confirmed_provider
        }
      } else if (painIndicatesBulk && s4.bulk_agreements.length === 0) {
        // Even if we can't name the provider, record the bulk signal from resident complaints
        s4.bulk_agreements.push({ provider: 'Unknown MDU ISP', service_type: 'internet', agreement_type: 'bulk', confidence: 'medium', evidence: `Resident complaints: "${painBulkSignals[0]?.quote?.slice(0, 100)}"` })
      }
    }

    // ── Step 7: Sonnet synthesis ───────────────────────────────────────────────
    const siloSummary = `STEP 1 — IDENTITY (verified):
${JSON.stringify({ name: property_name, address, city, state, units: s1.units, year_built: s1.year_built, property_class: s1.property_class, website: s1.website, phone: s1.phone, management_company: mgmt }, null, 2)}

STEP 2 — OWNERSHIP (verified):
${JSON.stringify({ owner_entity: owner, owner_type: s2.owner_type, acquisition_year: s2.acquisition_year, portfolio_size: s2.portfolio_size, old_name, sale_price: s2.sale_price }, null, 2)}

STEP 3 — PAIN SIGNALS (resident reviews/Reddit/social — last 12 months):
${JSON.stringify({ gate_issue_count: s3.gate_issue_count, internet_issue_count: s3.internet_issue_count, signals: s3.signals.slice(0, 12) }, null, 2)}

STEP 4 — CONNECTIVITY (FCC + web verified):
${JSON.stringify({ fcc_providers: s4.fcc_providers, isp_providers: s4.isp_providers, video_providers: s4.video_providers, bulk_agreements: s4.bulk_agreements, mandatory_tech_fee: s4.mandatory_tech_fee, bulk_detected: s4.bulk_detected, provider_confirmed: s4.provider_confirmed }, null, 2)}
${portfolioIspBlock ? `\nPORTFOLIO ISP DB:\n${portfolioIspBlock}` : ''}${cachedDetectionsBlock ? `\nCACHED DETECTIONS:\n${cachedDetectionsBlock}` : ''}${priorFindingsBlock ? `\nPRIOR FINDINGS:\n${priorFindingsBlock}` : ''}

STEP 5 — PROPTECH STACK (verified):
${JSON.stringify(s5, null, 2)}

STEP 6 — PEOPLE CHAIN (verified):
${JSON.stringify({ property_manager: s6.property_manager, regional_manager: s6.regional_manager, asset_manager: s6.asset_manager, contact_count: s6.all_contacts.length, email_format: s6.email_format }, null, 2)}`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3500,
      tools: [deepIntelTool],
      tool_choice: { type: 'tool', name: 'aria_deep_intel_result' },
      system: `You are assembling step-verified data into a final property intelligence report. Steps 1-6 are ground truth — copy them directly. Use synthesis only to fill gaps and write the sales brief.

CRITICAL COPY RULES:
1. property_details.units: copy from STEP 1 — do not modify
2. property_details.management_company: copy from STEP 1 mgmt — NEVER overwrite with a person's name
3. isp_providers: copy from STEP 4 — FCC/web verified ISPs only
4. video_providers: copy from STEP 4 — cable/satellite/IPTV providers
5. bulk_agreements: copy from STEP 4 — already structured; if no expiry_estimate yet, ESTIMATE it:
   - MDU fiber deals (GIGstreem, Hotwire, Pavlov) typically 7-10 year terms. Year built + 7-10 = first expiry window
   - Cable bulk deals (Comcast, Spectrum) typically 5-7 year terms
   - If bulk deal present but no expiry: set expiry_estimate = "Est. [year_built + 7]–[year_built + 10]"
6. proptech fields: copy from STEP 5
7. extracted_contacts: use STEP 6 — property_manager first, then regional, then asset manager
8. pain_signals: use STEP 3 signals — up to 12, last 6-12 months
9. ownership: copy from STEP 2
10. If management_company blank but owner is a RE firm → set management_company = owner_entity
11. proptech.replacement_window: estimate based on tech_generation + year_built (legacy pre-2015 = "Immediate", 2015-2019 = "1-3 years", 2020+ modern = "3-5 years")

CONTRACT WINDOW ESTIMATION (critical for sales):
- If year_built is known and bulk deal is detected but no expiry found:
  - fiber deals: expiry_estimate = "~[year_built + 8]–[year_built + 10] (estimated)"
  - cable deals: expiry_estimate = "~[year_built + 5]–[year_built + 7] (estimated)"
- If acquisition_year is recent (last 2 years), note "New ownership — capex window open" in capex_signal

CONTACT PRIORITY: Property Manager > Regional Manager > Asset Manager > CEO
- Copy all three levels (property_manager, regional_manager, asset_manager) from Step 6 exactly — do not discard any level
- If a contact has a constructed email (looks like firstname.lastname@domain), include it — it's a best-guess but label it as such only if evidence is absent
- Include phone and LinkedIn from Step 6 verbatim — never blank these if Step 6 found them

key_finding: "[WHO] at [company] controls this. [WHY NOW: specific pain signal / contract expiry window / acquisition / aging tech — be specific with dates and provider names]"
pitch_strategy.primary_hook: one sentence using THIS property's pain signal AND the contract window if known
pitch_strategy.social_proof: suggest a specific GateGuard case study angle relevant to this property type
freshness_score (1-5): 5=contract expiry this year or confirmed pain <3mo; 4=pain complaints <6mo; 3=listing confirmed; 2=older data; 1=inference only`,
      messages: [{ role: 'user', content: `Property: ${property_name}\nAddress: ${address || 'unknown'}\nLocation: ${location}\n\n${siloSummary}` }],
    })

    const toolBlock = message.content.find(b => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined
    if (!toolBlock) throw new Error('No synthesis result from Claude')
    const rawData = toolBlock.input as Record<string, any>

    // ── Build final payload ───────────────────────────────────────────────────
    const cleanIspProviders   = normStrArr(s4.isp_providers.length ? s4.isp_providers : (rawData.isp_providers ?? []))
    const cleanVideoProviders = normStrArr(s4.video_providers.length ? s4.video_providers : (rawData.video_providers ?? []))
    const cleanBulkAgreements = s4.bulk_agreements.length ? s4.bulk_agreements : (rawData.bulk_agreements ?? [])

    const mergedDMChain = s6.all_contacts.filter(c => c.name).map(c => ({
      name: c.name, title: c.title, company: c.company || mgmt || owner,
      role_type: c.role_type, email: c.email, top_email_format: s6.email_format,
      linkedin_slug: c.linkedin?.split('/in/')?.[1] || '',
    }))

    const bestContact = s6.property_manager || s6.regional_manager || s6.asset_manager || s6.all_contacts[0]
    const fallback    = (rawData.extracted_contacts || [])[0] || {}

    const scoutQueue = {
      property:      { name: property_name, address, city, state, units: s1.units, class: s1.property_class, management_company: mgmt, owner_entity: owner, old_name },
      pain_angles:   s3.signals.slice(0, 8).map(s => ({ type: s.type, quote: s.quote, severity: s.severity })),
      connectivity:  { isp_providers: cleanIspProviders, bulk_detected: s4.bulk_detected, provider_confirmed: s4.provider_confirmed, bulk_agreements: cleanBulkAgreements },
      proptech:      { gate_operators: s5.gate_operators, access_control: s5.access_control, tech_generation: s5.tech_generation },
      contact_chain: mergedDMChain.slice(0, 5),
      email_format:  s6.email_format,
      objection_flags: [
        ...(s4.bulk_detected && s4.provider_confirmed ? [`Existing bulk deal with ${cleanIspProviders[0]} — needs contract expiry`] : []),
        ...(s2.acquisition_year && parseInt(s2.acquisition_year) >= new Date().getFullYear() - 1 ? ['Recent acquisition — capex window open'] : []),
        ...(s3.gate_issue_count > 2 ? [`${s3.gate_issue_count} gate complaints — displacement signal`] : []),
      ],
      outreach_sequence: ['email_1', 'call_1', 'linkedin_touch', 'email_2'],
    }

    const prospectPayload = {
      property: {
        name: property_name,
        address: normStr(address || s1.address || location) || property_name,
        units:              normInt(s1.units ?? rawData.property_details?.units ?? rawData.units),
        property_type:      normStr(s1.property_type ?? rawData.property_details?.property_type) ?? 'multifamily',
        class:              normStr(s1.property_class ?? rawData.property_details?.class ?? rawData.property_class),
        year_built:         normInt(s1.year_built ?? rawData.property_details?.year_built ?? rawData.year_built),
        occupancy:          normStr(rawData.property_details?.occupancy),
        management_company: normStr(mgmt ?? rawData.property_details?.management_company) || normStr(owner ?? rawData.ownership?.owner_entity) || null,
        owner_entity:       normStr(owner || rawData.ownership?.owner_entity),
        old_name:           normStr(old_name),
        phone:              normStr(s1.phone),
        website:            normStr(s1.website),
        isp_providers:      cleanIspProviders,
        video_providers:    cleanVideoProviders,
        bulk_agreements:    cleanBulkAgreements,
        _fcc_verified:      s4.fcc_providers.length > 0,
        proptech: {
          gate_operators:       normStrArr(s5.gate_operators.length ? s5.gate_operators : rawData.proptech?.gate_operators),
          access_control:       normStrArr(s5.access_control.length ? s5.access_control : rawData.proptech?.access_control),
          intercoms:            normStrArr(s5.intercoms.length ? s5.intercoms : rawData.proptech?.intercoms),
          cameras:              normStrArr(s5.cameras.length ? s5.cameras : rawData.proptech?.cameras),
          smart_locks:          normStrArr(s5.smart_locks.length ? s5.smart_locks : rawData.proptech?.smart_locks),
          resident_apps:        normStrArr(s5.resident_apps.length ? s5.resident_apps : rawData.proptech?.resident_apps),
          package_solutions:    normStrArr(rawData.proptech?.package_solutions),
          tech_generation:      normStr(s5.tech_generation ?? rawData.proptech?.tech_generation) ?? 'legacy',
          sara_signals:         rawData.proptech?.sara_signals ?? false,
          replacement_window:   normStr(rawData.proptech?.replacement_window),
          displacement_targets: normStrArr(rawData.proptech?.displacement_targets),
        },
      },
      decision_maker: {
        name:             normStr(bestContact?.name || fallback.name) ?? null,
        title:            normStr(bestContact?.title || fallback.title) ?? null,
        company:          normStr(bestContact?.company || fallback.company) ?? mgmt ?? '',
        email:            normStr(bestContact?.email || fallback.email) ?? '',
        phone:            normStr(bestContact?.phone) ?? '',
        tenure_years:     0,
        top_email_format: s6.email_format || '',
        linkedin_slug:    normStr(bestContact?.linkedin?.split('/in/')?.[1] || fallback.linkedin_slug) ?? '',
      },
      decision_maker_chain: mergedDMChain.length > 0 ? mergedDMChain
        : (rawData.extracted_contacts || []).filter((c: any) => normStr(c.name)).map((c: any) => ({
            name: normStr(c.name) ?? '', title: normStr(c.title) ?? '', company: normStr(c.company) ?? '',
            role_type: 'unknown', email: normStr(c.email) ?? '', top_email_format: '', linkedin_slug: normStr(c.linkedin_slug) ?? '',
          })),
      ownership: {
        owner_entity:     normStr(owner || rawData.ownership?.owner_entity),
        owner_type:       normStr(s2.owner_type || rawData.ownership?.owner_type),
        portfolio_size:   normStr(s2.portfolio_size || rawData.ownership?.portfolio_size),
        acquisition_year: normStr(s2.acquisition_year || rawData.ownership?.acquisition_year),
        sale_price:       normStr(s2.sale_price),
        capex_signal:     normStr(rawData.ownership?.capex_signal),
      },
      pain_signals:      s3.signals.length > 0 ? s3.signals : (rawData.pain_signals ?? []),
      profile: {
        buy_score:           rawData.freshness_score ? Math.round(rawData.freshness_score * 1.5 + 2) : 5,
        urgency:             s3.gate_issue_count > 2 || s4.bulk_detected ? 'high' : 'medium',
        primary_concern:     normStr(rawData.key_finding?.slice(0, 300)) ?? 'No critical vulnerabilities detected',
        current_vendor:      normStr((cleanBulkAgreements[0] as any)?.provider ?? cleanIspProviders[0]),
        contract_window:     normStr((cleanBulkAgreements[0] as any)?.expiry_estimate),
        communication_style: normStr(rawData.behavioral_profile?.communication_pref) ?? 'Email',
      },
      behavioral_profile: rawData.behavioral_profile ?? null,
      pitch_strategy:     rawData.pitch_strategy ?? null,
      freshness_score:    rawData.freshness_score ?? 3,
      buying_trends:      normStr(rawData.buying_trends),
      scout_brief: {
        primary_contact:         normStr(bestContact?.name) ?? mgmt ?? property_name,
        outreach_angle:          s4.bulk_detected ? 'contract_window' : 'tech_displacement',
        contract_window_urgency: s4.bulk_detected ? 'high' : 'medium',
        key_data_points:         rawData.key_finding ? [rawData.key_finding] : [],
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
        query_interpretation: old_name ? `"${property_name}" (formerly "${old_name}")` : `ARIA v2 — ${property_name}`,
        results: { mode: 'deep', engine_version: ARIA_ENGINE_VERSION, prospects: [prospectPayload], fccVerified: s4.fcc_providers.length > 0, webIntelligence: true },
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
            return { provider_id: matched.id, property_name: property_name || null, property_address: address || null, confidence: a.confidence === 'high' ? 'high' : 'medium', source_type: 'aria', source_snippet: (a.evidence as string)?.slice(0, 250) ?? null, contract_end_year: yearMatch ? parseInt(yearMatch[0], 10) : null, verified_by: 'aria' }
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

    const edgarHit = s4.fcc_providers.length === 0
    return NextResponse.json({
      mode: 'deep',
      engine_version: ARIA_ENGINE_VERSION,
      query_interpretation: old_name ? `"${property_name}" (formerly "${old_name}")` : `ARIA ${ARIA_ENGINE_VERSION} — ${property_name}`,
      prospects: [prospectPayload],
      savedSearchId,
      sources: s3.raw_excerpts.filter(r => r.url && r.score > 0.3).slice(0, 8).map(r => ({
        title: r.title, url: r.url, excerpt: r.content.slice(0, 200), score: r.score, type: r.source ?? 'web',
      })),
      intelligence_sources: {
        edgar: edgarHit, fcc: s4.fcc_providers.length > 0,
        resident_reviews: s3.raw_excerpts.length > 0,
        apollo: s6.all_contacts.length > 0,
        proxycurl_verified: false,
        portfolio_isp_match: portfolioIspBlock.length > 0,
        old_name_detected: !!old_name,
        isp_confirmed: s4.provider_confirmed,
        serper_active: !!process.env.SERPER_API_KEY,
      },
      fccVerified: s4.fcc_providers.length > 0,
      webIntelligence: true,
    })

  } catch (err: any) {
    console.error('[aria/research/deep]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
