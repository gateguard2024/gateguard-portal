/**
 * POST /api/aria/research/deep
 *
 * ARIA Deep Intel — 4-silo parallel intelligence pipeline.
 * Architecture: Phase 0 (classify) → Phase 1 (property facts) → Phase 2 (silos B/C/D in parallel)
 *             → Phase 3 (gap fill) → Phase 4 (Apollo/ProxyCurl) → Phase 5 (Sonnet synthesis)
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

// ─── Query type classification ────────────────────────────────────────────

type QueryType = 'named_property' | 'prospecting_query'

interface QueryClassification {
  type: QueryType
  extracted_city: string
  extracted_state: string
  criteria_summary: string
}

async function classifyQuery(rawQuery: string, client: Anthropic): Promise<QueryClassification> {
  const fallback: QueryClassification = { type: 'named_property', extracted_city: '', extracted_state: '', criteria_summary: '' }
  const prospectingPatterns = /\b(find|looking for|any|HOA|apartment.*(with|near|in)|criteria|more than|over|units|contract expir|bulk internet|gated)\b/i
  if (!prospectingPatterns.test(rawQuery)) return fallback
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
      return JSON.parse(match[0]) as QueryClassification
    }
  } catch { /* fallback */ }
  return fallback
}

// ─── Prospecting: find specific candidate properties ──────────────────────

async function findCandidateProperties(rawQuery: string, city: string, state: string, criteria: string): Promise<TavilyResult[]> {
  if (!process.env.TAVILY_API_KEY) return []
  const geo = [city, state].filter(Boolean).join(', ') || 'Atlanta, GA'
  const queries = [
    `${geo} apartment community gated 500 units "bulk internet" OR "internet included" OR "managed wifi" site:apartments.com OR site:rentcafe.com`,
    `${geo} luxury gated apartment complex 500 units bulk internet OR "internet included" property management`,
    `${geo} HOA condominium complex 500+ units gated internet included gate access control`,
    `${geo} "best apartments" OR "luxury community" 500 units gated internet amenities 2024 OR 2025`,
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
      units: { type: 'number', description: 'Total number of apartment units/homes.' },
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
        description: 'Specific tenant complaints extracted from the review sentiment block.',
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

// ─── Silo data interfaces ─────────────────────────────────────────────────

interface SiloAData {
  corrected_name: string
  address: string
  city: string
  state: string
  units: number | null
  year_built: number | null
  property_class: string | null
  property_type: string
  occupancy: string
  management_company: string
  owner_entity: string
  acquisition_year: string
  portfolio_size: string
  isp_hints: string[]
  missing_fields: string[]
}

interface SiloBData {
  gate_operators: string[]
  access_control: string[]
  intercoms: string[]
  cameras: string[]
  smart_locks: string[]
  resident_apps: string[]
  managed_network_provider: string
  tech_generation: string
  missing_fields: string[]
}

interface SiloCData {
  isp_providers: string[]
  video_providers: string[]
  bulk_agreements: Array<{ provider: string; service_type: string; agreement_type: string; confidence: string; evidence: string }>
  mandatory_tech_fee: boolean
  missing_fields: string[]
}

interface SiloDContact {
  name: string
  title: string
  company: string
  role_type: string
  email: string
  phone: string
  linkedin: string
}

interface SiloDData {
  property_manager: SiloDContact
  regional_manager: SiloDContact
  asset_manager: SiloDContact
  all_contacts: Array<SiloDContact>
  missing_fields: string[]
}

// ─── Haiku JSON extraction helper ─────────────────────────────────────────

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
  } catch { /* fall through */ }
  return null
}

// ─── SILO A: Property Facts ───────────────────────────────────────────────

async function runSiloA(
  name: string,
  locationAnchor: string,
  address: string,
  city: string,
  state: string,
  rawMgmt: string,
  client: Anthropic
): Promise<{ data: SiloAData; results: TavilyResult[] }> {
  const blank: SiloAData = {
    corrected_name: name, address, city, state,
    units: null, year_built: null, property_class: null,
    property_type: 'multifamily', occupancy: '', management_company: rawMgmt,
    owner_entity: '', acquisition_year: '', portfolio_size: '', isp_hints: [],
    missing_fields: ['units', 'year_built'],
  }

  const searches = await Promise.all([
    tavilySearch(`"${name}" ${locationAnchor} site:apartments.com OR site:zillow.com OR site:rentcafe.com OR site:rent.com`, 5, 'silo-a'),
    tavilySearch(`"${name}" ${locationAnchor} "units" "year built" OR "built in" apartments management company`, 5, 'silo-a'),
    tavilySearch(`"${address}" OR "${name}" ${city} ${state} "property tax" OR "county assessor" OR "tax record" units apartments`, 4, 'silo-a'),
    tavilySearch(`"${name}" ${locationAnchor} acquired purchased ownership "private equity" OR "REIT" OR "portfolio" units`, 4, 'silo-a'),
    tavilySearch(`"${name}" ${locationAnchor} apartment floor plans amenities occupancy`, 4, 'silo-a'),
    tavilySearch(`"${name}" ${locationAnchor} site:apartmentlist.com OR site:forrent.com`, 4, 'silo-a'),
    searchEdgar(name, rawMgmt).then(r => r.map(e => ({ ...e, source: 'EDGAR' } as TavilyResult))),
  ])
  const allResults = searches.flat()
  const usable = allResults.filter(r => r.content?.length > 40).slice(0, 16)
  if (usable.length === 0) return { data: blank, results: allResults }

  const snippets = usable.map((r, i) => `[${i + 1}] ${r.title}\n${r.content.slice(0, 400)}`).join('\n\n---\n\n')
  const prompt = `Extract physical property facts. Return ONLY valid JSON:
{"corrected_name":"","address":"","city":"","state":"","units":null,"year_built":null,"property_class":null,"property_type":"","occupancy":"","management_company":"","owner_entity":"","acquisition_year":"","portfolio_size":"","isp_hints":[],"missing_fields":[]}
RULES: units=any "X units"/"X homes" number; use null for unknown numbers; empty string for unknown text; if management_company empty but owner is a RE firm, set management_company=owner_entity; missing_fields lists what you couldn't find`

  const extracted = await haikusExtract<SiloAData>(prompt, snippets, 600, client)
  if (!extracted) return { data: blank, results: allResults }
  if (!extracted.corrected_name || extracted.corrected_name.length < 2) extracted.corrected_name = name
  return { data: extracted, results: allResults }
}

// ─── SILO B: PropTech Stack ───────────────────────────────────────────────

async function runSiloB(
  name: string,
  location: string,
  mgmt: string,
  owner: string,
  client: Anthropic
): Promise<{ data: SiloBData; results: TavilyResult[] }> {
  const blank: SiloBData = {
    gate_operators: [], access_control: [], intercoms: [], cameras: [],
    smart_locks: [], resident_apps: [], managed_network_provider: '',
    tech_generation: 'legacy', missing_fields: ['gate_operators', 'access_control', 'intercoms', 'cameras'],
  }
  const entity = mgmt || owner

  const searches = await Promise.all([
    tavilySearch(`"${name}" ${location} ButterflyMX OR DoorKing OR LiftMaster OR Viking OR Linear OR PDK OR Doorbird gate intercom access`, 5, 'silo-b'),
    tavilySearch(`"${name}" ${location} Brivo OR Openpath OR HID OR SALTO OR Allegion "access control" OR "key fob"`, 5, 'silo-b'),
    tavilySearch(`"${name}" ${location} Verkada OR Avigilon OR "Eagle Eye" OR Hanwha cameras security`, 4, 'silo-b'),
    tavilySearch(`"${name}" ${location} SmartRent OR GateWise OR Latch OR August OR Yale OR Honeywell "smart home" OR "smart lock"`, 4, 'silo-b'),
    entity ? tavilySearch(`"${entity}" ButterflyMX OR DoorKing OR SmartRent OR Brivo OR LiftMaster portfolio standard MDU multifamily`, 4, 'silo-b') : Promise.resolve([] as TavilyResult[]),
    tavilySearch(`"${name}" ${location} "managed wifi" OR Plume OR Boingo OR "Single Digits" OR "Pavlov" leasing office`, 4, 'silo-b'),
  ])
  const allResults = searches.flat()
  const usable = allResults.filter(r => r.content?.length > 40).slice(0, 14)
  if (usable.length === 0) return { data: blank, results: allResults }

  const snippets = usable.map((r, i) => `[${i + 1}] ${r.title}\n${r.content.slice(0, 350)}`).join('\n\n---\n\n')
  const prompt = `Extract technology brands found for this property. Return ONLY valid JSON:
{"gate_operators":[],"access_control":[],"intercoms":[],"cameras":[],"smart_locks":[],"resident_apps":[],"managed_network_provider":"","tech_generation":"legacy","missing_fields":[]}
Known brands: gates=DoorKing/LiftMaster/Viking/Linear/PDK; access=Brivo/HID/SALTO/Openpath; intercoms=ButterflyMX/Aiphone/Viking/2N; cameras=Verkada/Avigilon/EagleEye/Hanwha; locks=SmartRent/GateWise/Latch/August/Yale
Empty arrays if not found. missing_fields=categories with no data.`

  const extracted = await haikusExtract<SiloBData>(prompt, snippets, 400, client)
  if (!extracted) return { data: blank, results: allResults }
  return { data: extracted, results: allResults }
}

// ─── SILO C: Connectivity / ISP ───────────────────────────────────────────

async function runSiloC(
  name: string,
  location: string,
  mgmt: string,
  owner: string,
  portfolioIspBlock: string,
  client: Anthropic
): Promise<{ data: SiloCData; results: TavilyResult[] }> {
  const blank: SiloCData = {
    isp_providers: [], video_providers: [], bulk_agreements: [],
    mandatory_tech_fee: false, missing_fields: ['isp_providers'],
  }
  const entity = mgmt || owner

  const [pucCity, pucState] = location.split(',').map(s => s.trim())
  const searches = await Promise.all([
    tavilySearch(`"${name}" ${location} site:apartments.com "internet included" OR "bulk internet" OR "wifi included" OR "technology fee"`, 5, 'silo-c', undefined, 'advanced'),
    tavilySearch(`"${name}" ${location} Gigstreem OR SpectrumU OR Hotwire OR Pavlov OR "Managed WiFi" internet`, 5, 'silo-c'),
    tavilySearch(`"${name}" OR "${entity}" site:gigstreem.com OR site:spectrumu.com OR site:hotwire.net OR site:pavlovmedia.com`, 4, 'silo-c', undefined, 'advanced'),
    tavilySearch(`"${name}" ${location} internet wifi "mandatory fee" OR "technology fee" OR "no choice" OR "forced" resident`, 4, 'silo-c', 'year', 'advanced'),
    tavilySearch(`"${name}" ${location} Comcast OR "AT&T" OR Cox OR Spectrum OR Frontier internet broadband`, 5, 'silo-c'),
    entity ? tavilySearch(`"${entity}" internet OR broadband MDU "bulk" OR "exclusive" OR "agreement" multifamily`, 4, 'silo-c') : Promise.resolve([] as TavilyResult[]),
    Promise.all([
      searchPUC(name, pucCity || '', pucState || ''),
      searchCityPermits(pucCity || '', pucCity || '', pucState || ''),
    ]).then(r => r.flat()),
    searchISPPressReleases(name, entity, location),
  ])
  const allResults = searches.flat()
  const usable = allResults.filter(r => r.content?.length > 40).slice(0, 16)
  if (usable.length === 0) return { data: blank, results: allResults }

  const snippets = usable.map((r, i) => `[${i + 1}] ${r.title}\n${r.content.slice(0, 400)}`).join('\n\n---\n\n')
  const portfolioContext = portfolioIspBlock ? `\n\nPORTFOLIO ISP INTELLIGENCE (inject into bulk_agreements with confidence=high):\n${portfolioIspBlock}` : ''
  const prompt = `Extract internet/video connectivity data. Return ONLY valid JSON:
{"isp_providers":[],"video_providers":[],"bulk_agreements":[{"provider":"","service_type":"internet","agreement_type":"bulk","confidence":"medium","evidence":""}],"mandatory_tech_fee":false,"missing_fields":[]}
CRITICAL: isp_providers = ONLY actual ISPs (Gigstreem/Comcast/AT&T/etc), NEVER management company names.
If PORTFOLIO ISP INTELLIGENCE block says [company]->[ISP], include it in bulk_agreements with confidence=high.
mandatory_tech_fee=true if any source mentions mandatory monthly wifi/internet/technology fee.${portfolioContext}`

  const extracted = await haikusExtract<SiloCData>(prompt, snippets, 500, client)
  if (!extracted) return { data: blank, results: allResults }
  return { data: extracted, results: allResults }
}

// ─── SILO D: People / Contacts ────────────────────────────────────────────

async function runSiloD(
  name: string,
  address: string,
  city: string,
  state: string,
  mgmt: string,
  owner: string,
  client: Anthropic
): Promise<{ data: SiloDData; results: TavilyResult[] }> {
  const emptyContact: SiloDContact = { name: '', title: '', company: '', role_type: '', email: '', phone: '', linkedin: '' }
  const blank: SiloDData = {
    property_manager: { ...emptyContact }, regional_manager: { ...emptyContact },
    asset_manager: { ...emptyContact }, all_contacts: [],
    missing_fields: ['property_manager', 'regional_manager'],
  }
  const entity = mgmt || owner
  const entitySlug = entity.toLowerCase().replace(/\s+(investment|corporation|partners|residential|capital|properties|group|llc|inc|reit)\s*/gi, '').replace(/\s+/g, '')
  const geo = [city, state].filter(Boolean).join(', ')

  const searches = await Promise.all([
    // Property-level
    tavilySearch(`"${name}" ${geo} "community manager" OR "property manager" OR "leasing manager" contact email phone`, 5, 'silo-d'),
    tavilySearch(`"${address}" ${city} "property manager" OR "community manager" OR "leasing office" contact`, 4, 'silo-d'),
    tavilySearch(`"${name}" ${city} apartments leasing office hours phone contact`, 4, 'silo-d'),
    // Regional-level
    entity ? tavilySearch(`"${entity}" ${city} ${state} "regional manager" OR "regional property manager" OR "area manager"`, 5, 'silo-d') : Promise.resolve([] as TavilyResult[]),
    entity ? tavilySearch(`"${entity}" ${city} "community manager" OR "leasing manager" site:linkedin.com`, 4, 'silo-d') : Promise.resolve([] as TavilyResult[]),
    entity ? tavilySearch(`"${entity}" ${state} "regional" OR "area" property manager email contact`, 4, 'silo-d') : Promise.resolve([] as TavilyResult[]),
    // Corporate/Asset
    entity ? tavilySearch(`site:theorg.com "${entity}"`, 4, 'silo-d') : Promise.resolve([] as TavilyResult[]),
    entity ? tavilySearch(`"${entity}" "asset manager" OR "portfolio manager" OR "director" ${state} apartment email`, 4, 'silo-d') : Promise.resolve([] as TavilyResult[]),
    entity ? tavilySearch(`"${entity}" "regional property manager" OR "community manager" site:rocketreach.co OR site:zoominfo.com`, 4, 'silo-d') : Promise.resolve([] as TavilyResult[]),
    entity && entitySlug ? tavilySearch(`"${entity}" "meet the team" OR "our team" OR "leadership" site:${entitySlug}.com`, 4, 'silo-d') : Promise.resolve([] as TavilyResult[]),
  ])
  const allResults = searches.flat()
  const usable = allResults.filter(r => r.content?.length > 40).slice(0, 18)
  if (usable.length === 0) return { data: blank, results: allResults }

  const snippets = usable.map((r, i) => `[${i + 1}] ${r.title}\n${r.content.slice(0, 400)}`).join('\n\n---\n\n')
  const prompt = `Extract ALL named individuals who work for or manage this property/company. Return ONLY valid JSON:
{"property_manager":{"name":"","title":"","company":"","role_type":"property_manager","email":"","phone":"","linkedin":""},"regional_manager":{"name":"","title":"","company":"","role_type":"regional_manager","email":"","phone":"","linkedin":""},"asset_manager":{"name":"","title":"","company":"","role_type":"asset_manager","email":"","phone":"","linkedin":""},"all_contacts":[{"name":"","title":"","company":"","role_type":"property_manager","email":"","phone":"","linkedin":""}],"missing_fields":[]}
role_type: property_manager=on-site; regional_manager=multi-property; asset_manager=financial oversight; corporate=C-suite
Prefer regional and property-level contacts over corporate executives.`

  const extracted = await haikusExtract<SiloDData>(prompt, snippets, 600, client)
  if (!extracted) return { data: blank, results: allResults }
  return { data: extracted, results: allResults }
}

// ─── Phase 3: Gap Fill ────────────────────────────────────────────────────

async function runGapFill(
  name: string,
  location: string,
  mgmt: string,
  owner: string,
  city: string,
  siloA: SiloAData,
  siloC: SiloCData,
  siloD: SiloDData,
  client: Anthropic
): Promise<{ updatedA: SiloAData; updatedC: SiloCData; updatedD: SiloDData }> {
  const gapFills: Array<Promise<void>> = []
  const entity = mgmt || owner

  if (siloA.units === null) {
    gapFills.push((async () => {
      const results = await tavilySearch(`"${name}" ${location} "apartment homes" OR "apartment units" total`, 4, 'gap-fill')
      const usable = results.filter(r => r.content?.length > 40).slice(0, 6)
      if (usable.length === 0) return
      const snippets = usable.map((r, i) => `[${i + 1}] ${r.title}\n${r.content.slice(0, 300)}`).join('\n\n---\n\n')
      const prompt = `Extract ONLY the total unit count for this apartment property. Return ONLY valid JSON: {"units": null_or_integer}`
      const result = await haikusExtract<{ units: number | null }>(prompt, snippets, 100, client)
      if (result?.units) siloA.units = result.units
    })())
  }

  if (siloC.isp_providers.length === 0) {
    gapFills.push((async () => {
      const results = await tavilySearch(`"${name}" ${location} internet reviews provider 2024 2025 resident`, 4, 'gap-fill', undefined, 'advanced')
      const usable = results.filter(r => r.content?.length > 40).slice(0, 6)
      if (usable.length === 0) return
      const snippets = usable.map((r, i) => `[${i + 1}] ${r.title}\n${r.content.slice(0, 300)}`).join('\n\n---\n\n')
      const prompt = `Extract ONLY ISP/internet provider names from these reviews. Return ONLY valid JSON: {"isp_providers": ["Provider1", "Provider2"]}`
      const result = await haikusExtract<{ isp_providers: string[] }>(prompt, snippets, 150, client)
      if (result?.isp_providers?.length) siloC.isp_providers = result.isp_providers
    })())
  }

  if (!siloD.property_manager?.name && city) {
    gapFills.push((async () => {
      const results = await tavilySearch(`"${name}" ${location} "on-site" manager contact info leasing`, 4, 'gap-fill')
      const usable = results.filter(r => r.content?.length > 40).slice(0, 6)
      if (usable.length === 0) return
      const snippets = usable.map((r, i) => `[${i + 1}] ${r.title}\n${r.content.slice(0, 300)}`).join('\n\n---\n\n')
      const prompt = `Extract the on-site property or community manager's name and contact for this apartment. Return ONLY valid JSON: {"name":"","title":"","email":"","phone":""}`
      const result = await haikusExtract<{ name: string; title: string; email: string; phone: string }>(prompt, snippets, 150, client)
      if (result?.name) {
        siloD.property_manager = { name: result.name, title: result.title || 'Community Manager', company: mgmt || owner, role_type: 'property_manager', email: result.email || '', phone: result.phone || '', linkedin: '' }
        if (!siloD.all_contacts.find(c => c.name === result.name)) {
          siloD.all_contacts.push(siloD.property_manager)
        }
      }
    })())
  }

  if (!siloD.regional_manager?.name && entity) {
    gapFills.push((async () => {
      const results = await tavilySearch(`"${entity}" ${city} property management staff regional`, 4, 'gap-fill')
      const usable = results.filter(r => r.content?.length > 40).slice(0, 6)
      if (usable.length === 0) return
      const snippets = usable.map((r, i) => `[${i + 1}] ${r.title}\n${r.content.slice(0, 300)}`).join('\n\n---\n\n')
      const prompt = `Extract the regional property manager or area manager name and contact for this management company. Return ONLY valid JSON: {"name":"","title":"","email":""}`
      const result = await haikusExtract<{ name: string; title: string; email: string }>(prompt, snippets, 150, client)
      if (result?.name) {
        siloD.regional_manager = { name: result.name, title: result.title || 'Regional Manager', company: entity, role_type: 'regional_manager', email: result.email || '', phone: '', linkedin: '' }
        if (!siloD.all_contacts.find(c => c.name === result.name)) {
          siloD.all_contacts.push(siloD.regional_manager)
        }
      }
    })())
  }

  await Promise.all(gapFills)
  return { updatedA: siloA, updatedC: siloC, updatedD: siloD }
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

    // ── Phase 0: Query classification ─────────────────────────────────────────
    let prospectDiscoveryNote: string | undefined
    const queryClass = await classifyQuery(rawQuery, anthropic)
    if (queryClass.type === 'prospecting_query') {
      const candidateResults = await findCandidateProperties(
        rawQuery, queryClass.extracted_city, queryClass.extracted_state, queryClass.criteria_summary,
      )
      const candidateNames = await extractCandidateNames(
        candidateResults, rawQuery, queryClass.extracted_city, anthropic,
      )
      if (candidateNames.length > 0) {
        prospectDiscoveryNote = `Prospecting query detected. Found candidate: "${candidateNames[0]}" (from criteria: ${queryClass.criteria_summary})`
        rawQuery = candidateNames[0]
      } else {
        prospectDiscoveryNote = `Prospecting query — no specific candidates found in ${queryClass.extracted_city || 'target city'}. Searching broadly.`
      }
    }

    // ── Hint params from request ───────────────────────────────────────────────
    const hintCity  = (raw.city as string)  || queryClass.extracted_city  || ''
    const hintState = (raw.state as string) || queryClass.extracted_state || ''
    const hintMgmt  = (raw.management_company as string) || ''
    const locationAnchor = [hintCity, hintState].filter(Boolean).join(' ')

    // ── DB lookups (parallel with Phase 1) ───────────────────────────────────
    let mduProviderSlugsDeep: Array<any> = []
    let mduAllProviderNames: string[] = []
    let cachedDetectionsBlockDeep = ''
    let priorFindingsBlock = ''
    let portfolioIspBlock = ''

    const [siloAResult] = await Promise.all([
      runSiloA(rawQuery, locationAnchor, raw.address || '', hintCity, hintState, hintMgmt, anthropic),
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
        (async () => {
          try {
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

    // ── Resolve confirmed property identity from Silo A ───────────────────────
    const siloAData = siloAResult.data
    const property_name = siloAData.corrected_name || rawQuery
    const address       = (raw.address as string) || siloAData.address || ''
    const city          = hintCity  || siloAData.city  || ''
    const state         = hintState || siloAData.state || ''
    const mgmt          = hintMgmt  || siloAData.management_company || ''
    const owner         = siloAData.owner_entity || ''
    const location      = [city, state].filter(Boolean).join(', ') || address || ''

    // ── Portfolio ISP lookup now that we have the real mgmt name ──────────────
    if (mgmt && !portfolioIspBlock) {
      try {
        const mgmtLower = mgmt.toLowerCase()
        const { data: portfolioRows } = await supabaseDeep
          .from('mgmt_isp_portfolio')
          .select('management_company_display, isp_name, agreement_type, coverage_states, coverage_notes, confidence')
          .ilike('management_company', `%${mgmtLower.split(' ')[0]}%`)
          .eq('active', true)
        if (portfolioRows && portfolioRows.length > 0) {
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

    // Re-fetch detections for corrected name if changed
    if (property_name !== rawQuery && !cachedDetectionsBlockDeep) {
      try {
        const { data: detections } = await supabaseDeep.from('mdu_provider_detections').select('confidence, source_type, source_snippet, contract_end_year, verified_by, mdu_providers ( name, provider_type )').ilike('property_name', `%${property_name}%`).in('confidence', ['confirmed', 'high', 'medium']).limit(10)
        if (detections && detections.length > 0) {
          const lines = detections.map((d: any) => `• ${d.mdu_providers?.name ?? 'Unknown'}: ${d.confidence} [${d.source_type}]`)
          cachedDetectionsBlockDeep = `\n\nGATEGUARD CACHED PROVIDER DETECTIONS:\n${lines.join('\n')}\n`
        }
      } catch {}
    }

    // ── Phase 2: Silos B, C, D in parallel ───────────────────────────────────
    const [siloBResult, siloCResult, siloDResult] = await Promise.all([
      runSiloB(property_name, location, mgmt, owner, anthropic),
      runSiloC(property_name, location, mgmt, owner, portfolioIspBlock, anthropic),
      runSiloD(property_name, address, city, state, mgmt, owner, anthropic),
    ])

    // ── Phase 3: Gap Fill ─────────────────────────────────────────────────────
    const { updatedA, updatedC, updatedD } = await runGapFill(
      property_name, location, mgmt, owner, city,
      siloAData, siloCResult.data, siloDResult.data,
      anthropic,
    )

    // ── Phase 4: Apollo + ProxyCurl ───────────────────────────────────────────
    const apolloEntity = mgmt || owner
    const apolloContacts = apolloEntity
      ? await apolloSearchContacts(apolloEntity, ['Chief Executive Officer', 'CEO', 'President', 'Vice President', 'Asset Manager', 'Regional Manager', 'Regional Property Manager', 'Director', 'Portfolio Manager', 'Property Manager', 'Community Manager'], location)
      : []
    const validatedDMs = await proxycurlValidateDMs(apolloContacts)
    const primaryDM = validatedDMs.find(d => d.isActiveCEO && d.confidence === 'proxycurl-verified') ?? validatedDMs.find(d => d.isActiveCEO) ?? validatedDMs.find(d => !d.isFormerOrAdvisory) ?? null
    const pdlDMProfile = primaryDM ? await pdlEnrichPerson(primaryDM.name, primaryDM.company, primaryDM.email) : null

    let apolloBlock = ''
    if (validatedDMs.length > 0) {
      const activeLines = validatedDMs.filter(d => !d.isFormerOrAdvisory).map(d => `• ${d.name} — ${d.currentTitle} at ${d.company}`)
      if (activeLines.length > 0) apolloBlock = `\n\nEXECUTIVE TRUTH LOOP RESULTS:\nACTIVE DECISION MAKERS:\n${activeLines.join('\n')}\n`
    }

    // ── Provider slug searches (legacy: ISP domain-specific) ─────────────────
    const providerSlugResults: TavilyResult[] = await (async () => {
      if (!process.env.TAVILY_API_KEY || mduProviderSlugsDeep.length === 0) return []
      const slugSearches = mduProviderSlugsDeep.slice(0, 8).map((p: any) => {
        const domain = ((p.property_page_pattern || p.operator_page_pattern || '') as string).replace(/\{.*?\}/g, '').replace(/\/$/, '')
        const domainOnly = domain.replace(/^https?:\/\//, '').split('/')[0]
        if (!domainOnly) return Promise.resolve([] as TavilyResult[])
        return tavilySearch(`"${property_name}" site:${domainOnly}`, 2, 'provider-slug')
      })
      const results = await Promise.allSettled(slugSearches)
      return results.filter((r): r is PromiseFulfilledResult<TavilyResult[]> => r.status === 'fulfilled').flatMap(r => r.value)
    })()

    // ── Resident reviews for pain signals ─────────────────────────────────────
    const reviewResults = await (async (): Promise<TavilyResult[]> => {
      if (!process.env.TAVILY_API_KEY) return []
      const queries: Array<[string, 'year' | undefined, 'basic' | 'advanced']> = [
        [`"${property_name}" ${location} internet OR wifi OR "internet provider" OR gate OR "access control" site:apartmentratings.com`, 'year', 'advanced'],
        [`"${property_name}" ${location} site:yelp.com reviews internet wifi provider fee`, undefined, 'advanced'],
        [`"${property_name}" ${location} internet provider wifi "no choice" OR "forced" OR "mandatory" OR "included in rent"`, 'year', 'advanced'],
        [`"${property_name}" ${location} "technology fee" OR "wifi fee" OR "internet fee" OR "Gigstreem" OR "managed wifi" site:apartments.com OR site:apartmentlist.com`, undefined, 'advanced'],
      ]
      const results = await Promise.all(queries.map(([q, t, d]) => tavilySearch(q, 5, 'resident-review', t, d)))
      return results.flat()
    })()

    const reviewSentimentBlock = await extractReviewSentiment(reviewResults, anthropic)

    // ── Collect all raw results for sources + excerpt block ───────────────────
    const allRawResults = [
      ...siloAResult.results, ...siloBResult.results, ...siloCResult.results, ...siloDResult.results,
      ...providerSlugResults, ...reviewResults,
    ]

    const seenUrls = new Set<string>()
    const deepBoostSources: Record<string, number> = {
      'provider-slug': 0.40, 'EDGAR': 0.30, 'PUC': 0.30, 'CityPermit': 0.30,
      'ISP-Press': 0.25, 'resident-review': 0.20, 'silo-c': 0.15, 'silo-d': 0.15,
    }
    const uniqueResults = allRawResults
      .filter(r => { if (seenUrls.has(r.url)) return false; seenUrls.add(r.url); return r.score > 0.25 })
      .sort((a, b) => (b.score + (deepBoostSources[b.source ?? ''] ?? 0)) - (a.score + (deepBoostSources[a.source ?? ''] ?? 0)))
      .slice(0, 22)

    if (uniqueResults.length === 0) {
      return NextResponse.json({ error: 'No data found.' }, { status: 404 })
    }

    const excerptBlock = uniqueResults.map((r, i) => `[Source ${i + 1}] [${r.source?.toUpperCase()}] ${r.title}\nURL: ${r.url}\n${r.content.slice(0, 500)}`).join('\n\n---\n\n')

    const edgarResults = allRawResults.filter(r => r.source === 'EDGAR')
    const pucResults   = allRawResults.filter(r => r.source === 'PUC')
    const permitResults = allRawResults.filter(r => r.source === 'CityPermit')
    const ispPressResults = allRawResults.filter(r => r.source === 'ISP-Press')
    const vendorFootprintResults = providerSlugResults

    // ── Phase 5: Sonnet synthesis with structured silo inputs ─────────────────
    const sourcesSummary = [
      edgarResults.length > 0    ? `[EDGAR: ${edgarResults.length} SEC filing(s)]` : null,
      pucResults.length > 0      ? `[PUC: ${pucResults.length} utility filing(s)]` : null,
      permitResults.length > 0   ? `[CityPermit: ${permitResults.length} permit(s)]` : null,
      ispPressResults.length > 0 ? `[ISP-Press: ${ispPressResults.length} press result(s)]` : null,
      vendorFootprintResults.length > 0 ? `[VENDOR-FOOTPRINT: ${vendorFootprintResults.length} vendor listing(s)]` : null,
      reviewResults.length > 0   ? `[RESIDENT-REVIEWS: ${reviewResults.length} review(s)]` : null,
      apolloContacts.length > 0  ? `[APOLLO: ${apolloContacts.length} contact(s)]` : null,
      validatedDMs.length > 0    ? `[PROXYCURL-VERIFIED: ${validatedDMs.length} DM(s) validated]` : null,
    ].filter(Boolean).join(' | ')

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      tools: [deepIntelTool],
      tool_choice: { type: 'tool', name: 'aria_deep_intel_result' },
      system: `You are assembling structured silo outputs into a final property intelligence report. Silo extractions are ground truth — do not contradict them. Use web excerpts only to fill remaining gaps not covered by silos.

CRITICAL — always populate these fields when any evidence exists:
• property_details.units: from SILO A — it is already verified. Copy it directly.
• property_details.year_built: from SILO A — copy directly.
• property_details.class: from SILO A property_class.
• property_details.management_company: from SILO A — use owner_entity fallback if management_company is empty.
• isp_providers: from SILO C isp_providers — these are verified ISPs only.
• bulk_agreements: from SILO C bulk_agreements — already structured.
• proptech fields: from SILO B — already categorized by type.
• extracted_contacts: from SILO D all_contacts — these are real people found in searches.
• pain_signals: from resident reviews and SILO C mandatory_tech_fee signals.

CRITICAL ENTITY RESOLUTION RULES:
1. NEVER confuse a Management Company or Owner with an Internet Service Provider.
2. isp_providers must contain ONLY actual ISPs. Management company names never belong here.
3. SELF-MANAGED FIRMS: If management_company is blank but owner is a known RE firm, set management_company = owner_entity.
4. DirecTV, DISH, Spectrum video → record as video_provider AND bulk_agreement with service_type "video".
5. If gated community with no brand, put "Unknown (gated)" in proptech.access_control.

CONTACT PRIORITY: Property-level (community manager, leasing manager) and Regional-level contacts are MORE valuable than corporate CEO. Always surface property_manager and regional_manager from SILO D first.

key_finding: "[WHO to call] at [company] controls capex. [WHY NOW: deal expiry, acquisition, aging tech, SEC signal]."
BEHAVIORAL PROFILE: analytical (PE/REIT, CFOs), driver (Regional VPs), expressive (Marketing PMs), amiable (Community managers)
PITCH STRATEGY: primary_hook = single opening sentence referencing THIS property's specific pain.
FRESHNESS SCORE (1–5): 5=SEC 8-K in 90d or contract expiry this year; 4=resident complaints 6mo or ISP press 1yr; 3=listing confirmed or EDGAR 10-K 2yr; 2=older web data; 1=all inference
edgar_signal: true if ANY EDGAR source was useful. permit_signal: true if ANY city permit/PUC confirms ISP infrastructure.`,
      messages: [{
        role: 'user',
        content: `Property: ${property_name}
Address: ${address || updatedA.address || 'unknown'}
Location: ${location}
Sources retrieved: ${sourcesSummary || 'web only'}

SILO A — PROPERTY FACTS (Haiku verified):
${JSON.stringify(updatedA, null, 2)}

SILO B — PROPTECH STACK (Haiku verified):
${JSON.stringify(siloBResult.data, null, 2)}

SILO C — CONNECTIVITY (Haiku verified):
${JSON.stringify(updatedC, null, 2)}

SILO D — CONTACTS (Haiku verified):
${JSON.stringify(updatedD, null, 2)}

APOLLO/PROXYCURL VERIFIED CONTACTS:
${apolloBlock || '(none)'}

PORTFOLIO ISP INTELLIGENCE:
${portfolioIspBlock || '(none)'}

PRIOR CONTRACT FINDINGS:
${priorFindingsBlock || '(none)'}

CACHED PROVIDER DETECTIONS:
${cachedDetectionsBlockDeep || '(none)'}
${reviewSentimentBlock}
RAW WEB EXCERPTS (for context / gap-filling only — silos above take precedence):
${excerptBlock}`,
      }],
    })

    const toolBlock = message.content.find(b => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined
    if (!toolBlock) throw new Error('No synthesis result from Claude')

    // ── Source metadata for response ──────────────────────────────────────────
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
      listing_sites:      allRawResults.filter(r => r.source === 'silo-a').some(r => r.score > 0.4),
      vendor_footprint:   vendorFootprintResults.length > 0,
      resident_reviews:   reviewResults.length > 0,
      apollo:             apolloContacts.length > 0,
      proxycurl_verified: validatedDMs.some(d => d.confidence === 'proxycurl-verified'),
      pdl:                pdlDMProfile !== null,
      dm_verified_count:  validatedDMs.filter(d => !d.isFormerOrAdvisory).length,
      portfolio_isp_match: portfolioIspBlock.length > 0,
    }

    // ── Data normalization helpers ────────────────────────────────────────────
    // Haiku/Sonnet sometimes return the STRING "null", "Unknown", "N/A", "none", "0"
    // instead of JSON null. These helpers coerce them to clean null/undefined.
    const SENTINEL_STRINGS = new Set(['null','undefined','unknown','n/a','na','none','not found','not available','','—','–','-','0'])
    function normStr(val: unknown): string | null {
      if (val === null || val === undefined) return null
      const s = String(val).trim()
      return SENTINEL_STRINGS.has(s.toLowerCase()) ? null : s
    }
    function normInt(val: unknown): number | null {
      if (val === null || val === undefined) return null
      if (typeof val === 'number') return val > 0 ? val : null
      // Strip non-numeric chars (handles "287 units", "~300", "287+")
      const n = parseInt(String(val).replace(/[^0-9]/g, ''), 10)
      return isNaN(n) || n <= 0 ? null : n
    }
    function normStrArr(arr: unknown): string[] {
      if (!Array.isArray(arr)) return []
      return arr
        .map(v => normStr(v))
        .filter((v): v is string => v !== null)
    }

    // ── Sanitization layer ────────────────────────────────────────────────────
    const rawData = toolBlock.input as Record<string, any>

    // Build DM chain: prefer silo D contacts over Apollo-only
    const siloDContacts = updatedD.all_contacts.filter(c => c.name)
    const apolloDMs = validatedDMs.map(dm => ({
      name: dm.name, title: dm.currentTitle, company: dm.company,
      role_type: dm.isActiveCEO ? 'owner' : 'asset_manager',
      email: dm.email || '', top_email_format: '',
      linkedin_slug: dm.linkedinUrl?.split('/in/')?.[1] || '',
    }))

    // Merge: silo D contacts first, then Apollo contacts not already named
    const mergedDMChain = [...siloDContacts.map(c => ({
      name: c.name, title: c.title, company: c.company || mgmt || owner,
      role_type: c.role_type || 'unknown',
      email: c.email || '', top_email_format: '',
      linkedin_slug: c.linkedin || '',
    })), ...apolloDMs.filter(ad => !siloDContacts.find(sc => sc.name === ad.name))]

    // Primary DM: prefer regional or property manager over CEO
    const regionalContact = updatedD.regional_manager?.name ? updatedD.regional_manager : null
    const propertyContact = updatedD.property_manager?.name ? updatedD.property_manager : null
    const bestSiloContact = regionalContact || propertyContact || siloDContacts[0]
    const bestApolloContact = validatedDMs.find(d => !d.isFormerOrAdvisory) ?? null
    const webContact = rawData.extracted_contacts?.[0] || {}

    const primaryContactName = bestSiloContact?.name || bestApolloContact?.name || webContact.name || mgmt || property_name
    const primaryContactTitle = bestSiloContact?.title || bestApolloContact?.currentTitle || webContact.title || 'Executive'
    const primaryContactCompany = bestSiloContact?.company || bestApolloContact?.company || webContact.company || mgmt
    const primaryContactEmail = bestSiloContact?.email || bestApolloContact?.email || webContact.email || ''
    const primaryContactLinkedin = bestSiloContact?.linkedin || bestApolloContact?.linkedinUrl?.split('/in/')?.[1] || webContact.linkedin_slug || ''

    // Clean silo outputs before using them (remove sentinel strings from arrays)
    const cleanIspProviders = normStrArr(rawData.isp_providers?.length ? rawData.isp_providers : updatedC.isp_providers)
    const cleanVideoProviders = normStrArr(rawData.video_providers?.length ? rawData.video_providers : updatedC.video_providers)
    const cleanBulkAgreements = (rawData.bulk_agreements?.length ? rawData.bulk_agreements : updatedC.bulk_agreements) ?? []

    const prospectPayload = {
      property: {
        name: property_name,
        address: normStr(address || updatedA.address || location) || property_name,
        // normInt handles string "287", "~300", "null", 0 → clean integer or null
        units:      normInt(rawData.property_details?.units ?? rawData.units ?? updatedA.units),
        property_type: normStr(rawData.property_details?.property_type ?? rawData.property_type ?? updatedA.property_type) ?? 'multifamily',
        class:      normStr(rawData.property_details?.class ?? rawData.property_class ?? updatedA.property_class),
        year_built: normInt(rawData.property_details?.year_built ?? rawData.year_built ?? updatedA.year_built),
        occupancy:  normStr(rawData.property_details?.occupancy ?? updatedA.occupancy),
        management_company: (() => {
          const rawMgmt = normStr(rawData.property_details?.management_company ?? mgmt ?? updatedA.management_company)
          const resolvedOwner = normStr(rawData.ownership?.owner_entity ?? owner)
          // Self-managed fallback: if mgmt unknown but owner is a real RE firm, use owner
          return rawMgmt || resolvedOwner || null
        })(),
        owner_entity: normStr(rawData.ownership?.owner_entity ?? owner),
        isp_providers:   cleanIspProviders,
        video_providers: cleanVideoProviders,
        bulk_agreements: cleanBulkAgreements,
        _fcc_verified: edgarResults.length > 0 || permitResults.length > 0,
        proptech: {
          gate_operators:   normStrArr(rawData.proptech?.gate_operators?.length ? rawData.proptech.gate_operators : siloBResult.data.gate_operators),
          access_control:   normStrArr(rawData.proptech?.access_control?.length ? rawData.proptech.access_control : siloBResult.data.access_control),
          intercoms:        normStrArr(rawData.proptech?.intercoms?.length ? rawData.proptech.intercoms : siloBResult.data.intercoms),
          cameras:          normStrArr(rawData.proptech?.cameras?.length ? rawData.proptech.cameras : siloBResult.data.cameras),
          smart_locks:      normStrArr(rawData.proptech?.smart_locks?.length ? rawData.proptech.smart_locks : siloBResult.data.smart_locks),
          resident_apps:    normStrArr(rawData.proptech?.resident_apps?.length ? rawData.proptech.resident_apps : siloBResult.data.resident_apps),
          package_solutions:normStrArr(rawData.proptech?.package_solutions),
          tech_generation:  normStr(rawData.proptech?.tech_generation ?? siloBResult.data.tech_generation) ?? 'legacy',
          sara_signals:     rawData.proptech?.sara_signals ?? false,
          replacement_window: normStr(rawData.proptech?.replacement_window),
          displacement_targets: normStrArr(rawData.proptech?.displacement_targets),
        }
      },
      decision_maker: {
        name:         normStr(primaryContactName) ?? mgmt ?? property_name,
        title:        normStr(primaryContactTitle) ?? 'Executive',
        company:      normStr(primaryContactCompany) ?? mgmt ?? '',
        email:        normStr(primaryContactEmail) ?? '',
        phone:        '',
        tenure_years: 0,
        top_email_format: '',
        linkedin_slug: normStr(primaryContactLinkedin) ?? '',
      },
      decision_maker_chain: mergedDMChain.length > 0
        ? mergedDMChain.filter(dm => normStr(dm.name) !== null)
        : (rawData.extracted_contacts || [])
            .filter((wc: any) => normStr(wc.name) !== null)
            .map((wc: any) => ({
              name: normStr(wc.name) ?? '', title: normStr(wc.title) ?? '', company: normStr(wc.company) ?? '',
              role_type: 'unknown', email: normStr(wc.email) ?? '', top_email_format: '',
              linkedin_slug: normStr(wc.linkedin_slug) ?? '',
            })),
      ownership: rawData.ownership ? {
        owner_entity:     normStr(rawData.ownership.owner_entity),
        owner_type:       normStr(rawData.ownership.owner_type),
        portfolio_size:   normStr(rawData.ownership.portfolio_size),
        acquisition_year: normStr(rawData.ownership.acquisition_year),
        capex_signal:     normStr(rawData.ownership.capex_signal),
      } : null,
      pain_signals: rawData.pain_signals ?? [],
      profile: {
        buy_score: rawData.freshness_score ? Math.round(rawData.freshness_score * 1.5 + 2) : 5,
        urgency: cleanBulkAgreements.length > 0 || (rawData.pain_signals ?? []).length > 0 ? 'high' : 'medium',
        primary_concern: normStr(rawData.key_finding?.slice(0, 80)) ?? 'No critical vulnerabilities detected',
        // current_vendor: prefer named ISP from agreements or providers, never "Unknown"
        current_vendor: normStr((cleanBulkAgreements[0] as any)?.provider ?? cleanIspProviders[0]),
        contract_window: normStr((cleanBulkAgreements[0] as any)?.expiry_estimate),
        communication_style: normStr(rawData.behavioral_profile?.communication_pref) ?? 'Email',
      },
      scout_brief: {
        primary_contact: normStr(primaryContactName) ?? mgmt ?? property_name,
        outreach_angle: rawData.atlas_opportunity ? 'contract_window' : 'tech_displacement',
        contract_window_urgency: 'medium',
        key_data_points: rawData.key_finding ? [rawData.key_finding] : [],
      },
    }

    // ── Save to aria_searches ─────────────────────────────────────────────────
    let savedSearchId: string | undefined
    try {
      const portalUser = await getCurrentUser()
      const originalQuery = raw.property_name || raw.query || rawQuery
      const { data: searchRow } = await supabaseDeep
        .from('aria_searches')
        .insert({
          query: originalQuery,
          query_interpretation: prospectDiscoveryNote ?? (property_name !== originalQuery ? `Searched as: ${property_name}` : 'ARIA Deep Intel'),
          results: { mode: 'deep', prospects: [prospectPayload], fccVerified: edgarResults.length > 0 || permitResults.length > 0, webIntelligence: true },
          search_type: 'deep',
          user_id: userId,
          user_name: portalUser.name,
          user_email: portalUser.email,
          org_id: portalUser.org_id ?? null,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select('id')
        .single()
      if (searchRow?.id) savedSearchId = searchRow.id
    } catch { /* best-effort */ }

    // ── Persist mdu_provider_detections (non-blocking) ────────────────────────
    const bulkAgreementsForDetection: any[] = rawData.bulk_agreements ?? []
    if (bulkAgreementsForDetection.length > 0) {
      void (async () => {
        try {
          const { data: allProviders } = await supabaseDeep.from('mdu_providers').select('id, name').eq('active', true)
          if (!allProviders) return
          const rows = bulkAgreementsForDetection
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
                confidence: a.confidence === 'confirmed' ? 'confirmed' : (a.confidence === 'high' ? 'high' : 'medium'),
                source_type: a.evidence_source ?? 'aria',
                source_snippet: a.evidence ? (a.evidence as string).slice(0, 250) : null,
                contract_end_year: yearMatch ? parseInt(yearMatch[0], 10) : null,
                verified_by: 'aria',
              }
            })
            .filter(Boolean)
          if (rows.length > 0) {
            await supabaseDeep.from('mdu_provider_detections').upsert(rows, { onConflict: 'provider_id,property_name', ignoreDuplicates: false })
          }
        } catch { /* non-blocking */ }
      })()
    }

    // ── Persist to Intel DB (non-blocking) ────────────────────────────────────
    void (async () => {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/aria/properties`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prospects: [prospectPayload] }),
        })
      } catch { /* non-blocking */ }
    })()

    return NextResponse.json({
      mode: 'deep',
      query_interpretation: prospectDiscoveryNote ?? 'ARIA Deep OSINT Aggregation',
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
