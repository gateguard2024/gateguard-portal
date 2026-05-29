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

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const ARIA_ENGINE_VERSION = 'v7.0'

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
}

async function runPhase1A(query: string, client: Anthropic): Promise<Phase1Result> {
  const blank: Phase1Result = {
    confirmed_name: null, confirmed_address: null, confirmed_city: null, confirmed_state: null,
    confirmed_units: null, confirmed_year_built: null,
    confirmed_management: null, confirmed_owner: null,
    confirmed_website: null, confirmed_phone: null,
    is_specific_property: false,
  }

  const [listingResults, pressResults] = await Promise.all([
    tavilySearch(
      `"${query}" apartments site:apartments.com OR site:rentcafe.com OR site:zillow.com OR site:apartmentlist.com`,
      5, 'listing', 'advanced', false
    ),
    serperSearch(
      `"${query}" apartments "apartment homes" OR units completed OR opened OR built`,
      5, 'press', 'news'
    ),
  ])

  const allResults = [...listingResults, ...pressResults]
  if (allResults.length === 0) return blank

  const snippets = allResults
    .filter(r => (r.content || '').length > 30)
    .slice(0, 10)
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`)
    .join('\n\n---\n\n')

  if (!snippets) return blank

  const extracted = await haikusExtract<Phase1Result>(
    `Extract verified property facts. Return ONLY valid JSON:
{"confirmed_name":null,"confirmed_address":null,"confirmed_city":null,"confirmed_state":null,"confirmed_units":null,"confirmed_year_built":null,"confirmed_management":null,"confirmed_owner":null,"confirmed_website":null,"confirmed_phone":null,"is_specific_property":false}

RULES:
- confirmed_name: exact community name found in results (not the query — the real name)
- confirmed_address: full street address if found
- confirmed_city + confirmed_state: REQUIRED if any geo context exists — extract from address or location mention
- confirmed_units: scan DEEPLY — patterns include "312 units", "312 apartment homes", "312-unit", "Total Units: 312", "312 studio", "N studio to"
- confirmed_year_built: 4-digit year from "built in YYYY", "Year Built: YYYY", "constructed YYYY", "opened YYYY", "completed YYYY", "delivered YYYY"
- confirmed_management: company that manages day-to-day operations
- confirmed_owner: investor/developer/owner entity. If developer's name appears IN the property name (e.g. "Northland Wharf 7" → Northland), set this field
- confirmed_website: official property URL (not apartments.com/zillow)
- confirmed_phone: leasing office phone number — examples "(404) 555-1234", "+1 833-571-2103"
- is_specific_property: true if results clearly identify ONE specific named property
- null if not found — never guess`,
    snippets, 1000, client
  )

  return extracted || blank
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
}

const KNOWN_MDU_BULK_ISPS = new Set([
  'gigstreem', 'hotwire', 'pavlov media', 'mdu communications', 'wired broadband',
  'all west', 'broadstripe', 'sonic mdu', 'xenon networks', 'apogee',
  'limecom', 'pocketinet', 'skybridge', 'bulk solutions', 'enterprise network services',
])

async function runPhase2(
  confirmedName: string,
  confirmedAddress: string,
  confirmedCity: string,
  confirmedState: string,
  confirmedMgmt: string,
  coords: { lat: number; lng: number } | null,
  client: Anthropic
): Promise<Phase2Result> {
  const blank: Phase2Result = {
    owner_entity: '', owner_type: '', acquisition_year: '',
    isp_providers: [], video_providers: [],
    bulk_detected: false, bulk_agreements: [], fcc_providers: [],
  }

  const geo = [confirmedCity, confirmedState].filter(Boolean).join(', ')

  const [fccProviders, bulkResults, ownerResults] = await Promise.all([
    coords ? fccBroadbandLookup(coords.lat, coords.lng) : Promise.resolve([] as string[]),
    tavilySearch(
      `"${confirmedName}" "${confirmedCity}" "${confirmedMgmt}" bulk internet OR "internet included" OR MDU`,
      5, 'bulk', 'advanced', false
    ),
    serperSearch(
      `"${confirmedAddress || confirmedName}" sold acquired ownership "private equity" OR REIT`,
      5, 'owner', 'news'
    ),
  ])

  const fccLower = fccProviders.map(p => p.toLowerCase())
  const knownMduInFcc = fccLower.some(p => [...KNOWN_MDU_BULK_ISPS].some(mdu => p.includes(mdu)))

  const allResults = [...bulkResults, ...ownerResults]
  const usable = allResults.filter(r => (r.content || '').length > 40).slice(0, 12)

  const snippets = usable
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.content.slice(0, 400)}`)
    .join('\n\n---\n\n')

  const fccCtx = fccProviders.length > 0
    ? `\n\nFCC BROADBAND MAP (confirmed at coordinates):\n${fccProviders.map(p => `• ${p}`).join('\n')}`
    : ''

  const extracted = snippets.length > 80
    ? await haikusExtract<Omit<Phase2Result, 'fcc_providers'>>(
        `Extract ownership and connectivity data. Return ONLY valid JSON:
{"owner_entity":"","owner_type":"","acquisition_year":"","isp_providers":[],"video_providers":[],"bulk_detected":false,"bulk_agreements":[]}

RULES:
- owner_entity: investor/REIT/PE firm/LLC that owns the property
- owner_type: "private_equity","reit","family_office","institutional","local" or ""
- acquisition_year: 4-digit year of last sale/acquisition, or ""
- isp_providers: actual ISPs (never management company names)
- video_providers: cable/satellite/IPTV (DirecTV, Dish, Xfinity, Spectrum TV)
- bulk_detected: true if internet included in rent OR bulk/exclusive deal found OR tech fee mentioned
- bulk_agreements: [{"provider":"","service_type":"internet","agreement_type":"bulk","confidence":"high","evidence":"","expiry_estimate":""}]${fccCtx}`,
        snippets, 700, client
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
  client: Anthropic
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

  // 5 parallel searches
  const [painResults, proptechResults, contactResults] = await Promise.all([
    serperSearch(`"${confirmedName}" "${geo}" reviews complaints internet gate crime`, 5, 'pain'),
    tavilySearch(`"${confirmedName}" "${geo}" ButterflyMX OR DoorKing OR Brivo OR Openpath OR Verkada OR Avigilon OR SmartRent OR Latch OR LiftMaster OR HID OR SALTO`, 5, 'proptech', 'advanced', false),
    entity
      ? serperSearch(`"${entity}" "${geo}" "community manager" OR "regional manager" site:linkedin.com`, 5, 'contacts')
      : Promise.resolve([] as TavilyResult[]),
  ])

  const allResults = [...painResults, ...proptechResults, ...contactResults]

  // Pain signal extraction
  const painSnippets = painResults.filter(r => (r.content || '').length > 40).slice(0, 8)
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.content.slice(0, 400)}`).join('\n\n---\n\n')

  const painExtracted = painSnippets.length > 80
    ? await haikusExtract<{ signals: PainSignal[] }>(
        `Extract resident pain signals. Return ONLY valid JSON:
{"signals":[{"type":"gate","quote":"","source":"","date":"","severity":"high"}]}
type: "gate","internet","camera","crime","management","smart_lock","general"
quote: verbatim (max 150 chars)
severity: high=safety/major failure, medium=recurring, low=minor
Up to 12 signals. Prefer last 12 months.`,
        painSnippets, 700, client)
    : null

  // PropTech extraction
  const proptechSnippets = proptechResults.filter(r => (r.content || '').length > 40).slice(0, 10)
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.content.slice(0, 350)}`).join('\n\n---\n\n')

  const proptechExtracted = proptechSnippets.length > 80
    ? await haikusExtract<Phase3Result['proptech']>(
        `Extract property technology brands. Return ONLY valid JSON:
{"gate_operators":[],"access_control":[],"intercoms":[],"cameras":[],"smart_locks":[],"resident_apps":[],"package_solutions":[],"tech_generation":"legacy"}
Known brands:
- gates: DoorKing/LiftMaster/Viking/Linear/FAAC/PDK
- access: Brivo/HID/SALTO/Openpath/PDK/Kisi
- intercoms: ButterflyMX/Aiphone/Viking/2N/Doorbird/Verkada
- cameras: Verkada/Avigilon/EagleEye/Hanwha/Axis/Hikvision
- smart_locks: SmartRent/GateWise/Latch/August/Yale/Schlage
- resident_apps: SmartRent/Entrata/RealPage/Yardi/AppFolio
- package_solutions: "Parcel Pending"/"Amazon Hub"/"Package Concierge"/"Luxer One"
tech_generation: "legacy"=pre-2018, "modern"=2018+, "hybrid"=mix
Empty arrays for nothing found.`,
        proptechSnippets, 500, client)
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

  return {
    pain_signals: painExtracted?.signals ?? [],
    proptech: proptechExtracted ?? blank.proptech,
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
        items: {
          type: 'object',
          properties: { name: { type: 'string' }, title: { type: 'string' }, company: { type: 'string' }, email: { type: 'string' }, linkedin_slug: { type: 'string' } },
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

    // ── PHASE 1A: Specific property — listing sites + press ──────────────────
    const p1 = await runPhase1A(rawQuery, anthropic)

    const property_name = p1.confirmed_name || rawQuery
    const address = p1.confirmed_address || ''
    const city = p1.confirmed_city || classification.city_hint || ''
    const state = p1.confirmed_state || classification.state_hint || ''
    const mgmt = p1.confirmed_management || classification.mgmt_hint || ''
    const owner = p1.confirmed_owner || ''
    const website = p1.confirmed_website || ''

    // STOP: if no city/state confirmed and not specific
    if (!city && !state && !p1.is_specific_property) {
      return NextResponse.json({ error: 'Property not found. Try a more specific query (include city/state).' }, { status: 404 })
    }

    // Geocode
    const coords = await geocodeAddress(address || property_name, city, state)

    // ── PHASES 2 + 3 in parallel ──────────────────────────────────────────────
    const [p2, p3] = await Promise.all([
      runPhase2(property_name, address, city, state, mgmt, coords, anthropic),
      runPhase3(property_name, city, state, mgmt, owner, website, anthropic),
    ])

    const finalOwner = p2.owner_entity || owner || ''

    // ── PHASE 4: Synthesis ────────────────────────────────────────────────────
    const synthesisData = `PHASE 1 — VERIFIED IDENTITY:
${JSON.stringify({ name: property_name, address, city, state, units: p1.confirmed_units, year_built: p1.confirmed_year_built, management_company: mgmt, website, phone: p1.confirmed_phone }, null, 2)}

PHASE 2 — ENRICHMENT:
${JSON.stringify({ owner_entity: finalOwner, owner_type: p2.owner_type, acquisition_year: p2.acquisition_year, fcc_providers: p2.fcc_providers, isp_providers: p2.isp_providers, video_providers: p2.video_providers, bulk_detected: p2.bulk_detected, bulk_agreements: p2.bulk_agreements }, null, 2)}

PHASE 3 — INTELLIGENCE:
${JSON.stringify({ pain_signals: p3.pain_signals.slice(0, 12), proptech: p3.proptech, contact_count: p3.contacts.length, email_format: p3.email_format }, null, 2)}`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3500,
      tools: [deepIntelTool],
      tool_choice: { type: 'tool', name: 'aria_deep_intel_result' },
      system: `You assemble step-verified data into a final property intelligence report. Phases 1-3 are ground truth — copy directly. Use synthesis only to fill gaps and write the sales brief.

CRITICAL RULES:
1. property_details.units: copy from Phase 1
2. property_details.management_company: copy from Phase 1 — NEVER overwrite with a person's name
3. isp_providers / video_providers: copy from Phase 2
4. bulk_agreements: copy from Phase 2. If no expiry yet, estimate:
   - MDU fiber deals: year_built + 7-10
   - Cable bulk deals: year_built + 5-7
   Set expiry_estimate = "Est. [year]-[year]"
5. proptech: copy from Phase 3
6. extracted_contacts: copy from Phase 3 contacts
7. pain_signals: copy from Phase 3 — up to 12 recent
8. ownership: build from Phase 2 owner_entity + owner_type + acquisition_year
9. If management_company blank but owner is RE firm → set management_company = owner_entity
10. proptech.replacement_window: based on tech_generation + year_built (pre-2015=Immediate, 2015-19=1-3yr, 2020+=3-5yr)

CONTRACT WINDOW (critical):
- If acquisition_year is last 2 years, add "New ownership — capex window open" to capex_signal

CONTACT PRIORITY: Property Manager > Regional > Asset Manager > CEO

key_finding: "[WHO] at [company] controls this. [WHY NOW: specific pain/contract/acquisition signal]"
pitch_strategy.primary_hook: 1 sentence using THIS property's pain + contract window
behavioral_profile: decision_style, communication_pref, risk_tolerance, budget_orientation
freshness_score (1-10): 10=critical signals + recent acquisition; 8=contract expiry known; 6=pain signals; 4=basic intel; 2=inference only
buying_trends: 1-sentence sales trend insight for this property type`,
      messages: [{ role: 'user', content: `Property: ${property_name}\nLocation: ${city}, ${state}\n\n${synthesisData}` }],
    })

    const toolBlock = message.content.find(b => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined
    if (!toolBlock) throw new Error('No synthesis result from Claude')
    const rawData = toolBlock.input as Record<string, any>

    // ── Build final payload ───────────────────────────────────────────────────
    const cleanIspProviders = normStrArr(p2.isp_providers.length ? p2.isp_providers : (rawData.isp_providers ?? []))
    const cleanVideoProviders = normStrArr(p2.video_providers.length ? p2.video_providers : (rawData.video_providers ?? []))
    const cleanBulkAgreements = p2.bulk_agreements.length ? p2.bulk_agreements : (rawData.bulk_agreements ?? [])

    const mergedDMChain = p3.contacts.filter(c => c.name).map(c => ({
      name: c.name, title: c.title, company: c.company || mgmt || finalOwner,
      role_type: c.role_type, email: c.email, top_email_format: p3.email_format,
      phone: c.phone || '',
      linkedin_slug: c.linkedin?.split('/in/')?.[1] || '',
    }))

    const bestContact = p3.contacts.find(c => c.role_type === 'property_manager')
      || p3.contacts.find(c => c.role_type === 'regional_manager')
      || p3.contacts.find(c => c.role_type === 'asset_manager')
      || p3.contacts[0]

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
        management_company: mgmt, owner_entity: finalOwner, old_name: null,
      },
      pain_angles: p3.pain_signals.slice(0, 8).map(s => ({ type: s.type, quote: s.quote, severity: s.severity })),
      connectivity: {
        isp_providers: cleanIspProviders,
        bulk_detected: p2.bulk_detected,
        provider_confirmed: cleanIspProviders.length > 0,
        bulk_agreements: cleanBulkAgreements,
      },
      proptech: { gate_operators: p3.proptech.gate_operators, access_control: p3.proptech.access_control, tech_generation: p3.proptech.tech_generation },
      contact_chain: mergedDMChain.slice(0, 5),
      email_format: p3.email_format,
      objection_flags: [
        ...(p2.bulk_detected && cleanIspProviders.length > 0 ? [`Existing bulk deal with ${cleanIspProviders[0]} — needs contract expiry`] : []),
        ...(p2.acquisition_year && parseInt(p2.acquisition_year) >= new Date().getFullYear() - 1 ? ['Recent acquisition — capex window open'] : []),
      ],
      outreach_sequence: ['email_1', 'call_1', 'linkedin_touch', 'email_2'],
    }

    const prospectPayload = {
      property: {
        name: property_name,
        address: normStr(address) || property_name,
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
        phone: normStr(bestContact?.phone) ?? '',
        tenure_years: 0,
        top_email_format: p3.email_format || '',
        linkedin_slug: normStr(bestContact?.linkedin?.split('/in/')?.[1] || fallback.linkedin_slug) ?? '',
      },
      decision_maker_chain: mergedDMChain.length > 0 ? mergedDMChain
        : (rawData.extracted_contacts || []).filter((c: any) => normStr(c.name)).map((c: any) => ({
            name: normStr(c.name) ?? '', title: normStr(c.title) ?? '', company: normStr(c.company) ?? '',
            role_type: 'unknown', email: normStr(c.email) ?? '', top_email_format: '',
            phone: '', linkedin_slug: normStr(c.linkedin_slug) ?? '',
          })),
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
        current_vendor: normStr((cleanBulkAgreements[0] as any)?.provider ?? cleanIspProviders[0]),
        contract_window: normStr((cleanBulkAgreements[0] as any)?.expiry_estimate),
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
