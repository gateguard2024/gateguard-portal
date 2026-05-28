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

async function tavilySearch(query: string, maxResults = 5, source = 'web', search_time?: 'day' | 'week' | 'month' | 'year'): Promise<TavilyResult[]> {
  if (!process.env.TAVILY_API_KEY) return []
  try {
    const body: Record<string, unknown> = {
      query, search_depth: 'basic', max_results: maxResults, include_answer: false, include_raw_content: false, include_images: false,
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
  const queries: Array<[string, 'year' | undefined]> = [
    [`"${propertyName}" internet OR wifi OR "internet provider" OR gate OR "access control" site:apartmentratings.com`, 'year'],
    [`"${propertyName}" ${location} internet provider wifi site:reddit.com`, 'year'],
    [`"${propertyName}" "switched" OR "changed" internet OR wifi provider OR "Gigstreem" OR "managed wifi"`, 'year'],
    [`"${propertyName}" ${location} "internet included" OR "wifi included" OR "bulk internet" site:apartmentlist.com OR site:apartments.com`, undefined],
  ]
  const results = await Promise.all(queries.map(([q, t]) => tavilySearch(q, 5, 'resident-review', t)))
  return results.flat()
}

// ─── Vendor footprint search ──────────────────────────────────────────────

async function searchVendorFootprint(propertyName: string, managementCompany: string, location: string, dbProviderNames: string[] = []): Promise<TavilyResult[]> {
  if (!process.env.TAVILY_API_KEY) return []
  const fallbackProviders = ['Gigstreem', 'Managed WiFi', 'managed internet', 'SpectrumU', 'Hotwire', 'Vyve', 'Sonic', 'WideOpenWest', 'WOW', 'TDS Telecom', 'Metronet', 'Brightspeed', 'Astound', 'Pavlov Media', 'Single Digits', 'Boingo', 'Zentro']
  const allProviders = dbProviderNames.length > 0 ? [...new Set([...dbProviderNames, ...fallbackProviders])] : fallbackProviders
  const providerKeywords = allProviders.slice(0, 12).join(' OR ')
  const knownDomains = ['gigstreem.com', 'spectrumu.com', 'pavlovmedia.com', 'singledigits.com', 'hotwire.net', 'zentro.com', 'dojonetworks.com'].map(d => `site:${d}`).join(' OR ')

  const queries = [
    `"${propertyName}" ${providerKeywords}`,
    managementCompany ? `"${managementCompany}" ${providerKeywords} "case study" OR "partnership" OR "community" OR "units"` : `"${propertyName}" ${location} "managed wifi" OR "bulk internet" case study OR partnership`,
    `"${propertyName}" OR "${managementCompany || propertyName}" ${knownDomains}`,
  ]
  const results = await Promise.all(queries.map(q => tavilySearch(q, 5, 'vendor-footprint')))
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
    required: ['isp_providers', 'video_providers', 'bulk_agreements', 'key_finding', 'confidence', 'proptech', 'pain_signals'],
    properties: {
      isp_providers: { type: 'array', items: { type: 'string' } },
      video_providers: { type: 'array', items: { type: 'string' } },
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
      key_finding: { type: 'string' },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
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
          asset_manager: {
            type: 'object',
            properties: { name: { type: 'string' }, title: { type: 'string' }, company: { type: 'string' }, linkedin_slug: { type: 'string' }, email: { type: 'string' } },
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
    const property_name: string   = raw.property_name || raw.query || ''
    const address: string         = raw.address || ''
    const management_company: string = raw.management_company || ''
    const city: string            = raw.city || ''
    const state: string           = raw.state || ''

    if (!property_name) return NextResponse.json({ error: 'property_name or query required' }, { status: 400 })

    const location = [city, state].filter(Boolean).join(', ') || address || ''
    const mgmt = management_company || ''

    let mduProviderSlugsDeep: Array<any> = []
    let mduAllProviderNames: string[] = []
    let cachedDetectionsBlockDeep = ''
    let priorFindingsBlock = ''

    await Promise.allSettled([
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
          const { data: detections } = await supabaseDeep.from('mdu_provider_detections').select('confidence, source_type, source_snippet, contract_end_year, verified_by, mdu_providers ( name, provider_type )').ilike('property_name', `%${property_name}%`).in('confidence', ['confirmed', 'high', 'medium']).limit(10)
          if (detections && detections.length > 0) {
            const lines = detections.map((d: any) => `• ${d.mdu_providers?.name ?? 'Unknown'}: ${d.confidence} [${d.source_type}]`)
            cachedDetectionsBlockDeep = `\n\nGATEGUARD CACHED PROVIDER DETECTIONS:\n${lines.join('\n')}\n`
          }
        } catch {}
      })(),
      (async () => {
        try {
          const { data: findings } = await supabaseDeep.from('aria_contract_findings').select('provider_name, agreement_type, service_type, expiry_year, expiry_date, confidence, source_type, source_snippet').or(`property_name.ilike.%${property_name}%${address ? `,property_address.ilike.%${address}%` : ''}`).in('confidence', ['confirmed', 'high', 'medium-high']).order('created_at', { ascending: false }).limit(10)
          if (findings && findings.length > 0) {
            const lines = findings.map((f: any) => `• ${f.provider_name} — ${f.agreement_type} ${f.service_type} [${f.confidence}]`)
            priorFindingsBlock = `\n\nGATEGUARD PRIOR CONTRACT FINDINGS:\n${lines.join('\n')}\n`
          }
        } catch {}
      })(),
    ])

    const [
      ispResults, bulkResults, mgmtResults, redditResults, gateResults, proptechResults, residentTechResults,
      mgmtProptechResults, localIspResults, ownershipResults, providerSlugResultsDeep, edgarResults, pucResults,
      permitResults, ispPressResults, temporalReviewResults, vendorFootprintResults
    ] = await Promise.all([
      tavilySearch(`"${property_name}" ${location} internet provider ISP service`, 5, 'web'),
      tavilySearch(`"${property_name}" "internet included" OR "bulk internet" OR "fiber included" OR "Comcast included" OR "Spectrum included" OR "AT&T included" OR "preferred provider" OR "gigastream" OR "sonic" OR "hotwire" OR "vyve" OR "local internet"`, 5, 'web'),
      mgmt ? tavilySearch(`"${mgmt}" MDU internet bulk agreement exclusive OR "local ISP" OR "regional fiber"`, 5, 'web') : Promise.resolve([]),
      tavilySearch(`"${property_name}" ${location} internet ISP "locked in" OR "only option" OR "bulk deal" OR "included with rent" OR "can only use" OR "building internet"`, 5, 'web'),
      tavilySearch(`"${property_name}" ${location} gate intercom "access control" cameras security technology vendor`, 5, 'web'),
      tavilySearch(`"${property_name}" OR "${mgmt}" ButterflyMX OR Brivo OR LiftMaster OR DoorKing OR SmartRent OR Latch OR Openpath OR Verkada OR "Eagle Eye"`, 5, 'web'),
      tavilySearch(`"${property_name}" "gate broken" OR "gate stuck" OR "intercom" OR "key fob" OR "access" OR "package" OR "smart lock" OR "cameras not working"`, 5, 'web'),
      mgmt ? tavilySearch(`"${mgmt}" multifamily proptech "access control" OR "gate operator" OR "smart home" preferred vendor standard`, 4, 'web') : Promise.resolve([]),
      tavilySearch(`"${property_name}" ${location} "bulk internet" OR "internet included" OR "fiber included" site:apartmentlist.com OR site:apartments.com OR site:zillow.com OR site:rent.com OR site:apartmentratings.com`, 5, 'listing-site'),
      tavilySearch(`"${property_name}" ${location} "asset manager" OR "portfolio manager" OR "ownership" OR "acquired" OR "owner" OR "investment" multifamily`, 4, 'web'),
      (async () => {
        if (!process.env.TAVILY_API_KEY || mduProviderSlugsDeep.length === 0) return []
        const slugSearches = mduProviderSlugsDeep.slice(0, 6).map((p: any) => {
          const domain = ((p.property_page_pattern || p.operator_page_pattern || '') as string).replace(/\{.*?\}/g, '').replace(/\/$/, '')
          const domainOnly = domain.replace(/^https?:\/\//, '').split('/')[0]
          if (!domainOnly) return Promise.resolve([])
          return tavilySearch(`"${property_name}" site:${domainOnly}`, 2, 'provider-slug')
        })
        const results = await Promise.allSettled(slugSearches)
        return results.filter((r): r is PromiseFulfilledResult<TavilyResult[]> => r.status === 'fulfilled').flatMap(r => r.value)
      })(),
      searchEdgar(property_name, mgmt),
      searchPUC(property_name, address || '', state || ''),
      searchCityPermits(address || property_name, city || '', state || ''),
      searchISPPressReleases(property_name, mgmt, location),
      searchResidentReviewsTemporal(property_name, location),
      searchVendorFootprint(property_name, mgmt, location, mduAllProviderNames),
    ])

    const apolloContacts = mgmt ? await apolloSearchContacts(mgmt, ['Chief Executive Officer', 'CEO', 'President', 'Vice President', 'Asset Manager', 'Regional Manager', 'Director', 'Portfolio Manager', 'Property Manager'], location) : []
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
    ]

    const edgarAsResults: TavilyResult[] = edgarResults.map(e => ({ title: e.title, url: e.url, content: `[SEC EDGAR — PRIMARY SOURCE] ${e.content}`, score: e.score, source: e.source }))
    const allResults = [...edgarAsResults, ...tavilyAll]

    const seenUrls = new Set<string>()
    const uniqueResults = allResults.filter(r => { if (seenUrls.has(r.url)) return false; seenUrls.add(r.url); return r.score > 0.25 }).sort((a, b) => b.score - a.score).slice(0, 22)

    if (uniqueResults.length === 0) {
      return NextResponse.json({ error: 'No data found.' }, { status: 404 })
    }

    const reviewSnippets = uniqueResults.filter(r => r.source === 'resident-review' || (r.source === 'web' && (r.url.includes('apartmentratings') || r.url.includes('reddit'))))
    const reviewSentimentBlock = await extractReviewSentiment(reviewSnippets, anthropic)
    const excerptBlock = uniqueResults.map((r, i) => `[Source ${i + 1}] [${r.source?.toUpperCase()}] ${r.title}\nURL: ${r.url}\n${r.content.slice(0, 500)}`).join('\n\n---\n\n')

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      tools: [deepIntelTool],
      tool_choice: { type: 'tool', name: 'aria_deep_intel_result' },
      system: `You are ARIA's deep connectivity, proptech, and ownership intelligence module. Extact all details into the tool.`,
      messages: [{
        role: 'user',
        content: `Property: ${property_name}\nLocation: ${location}\nManagement Company: ${mgmt || 'unknown'}\n${priorFindingsBlock}${cachedDetectionsBlockDeep}${apolloBlock}${reviewSentimentBlock}\nIntelligence excerpts:\n${excerptBlock}`
      }],
    })

    const toolBlock = message.content.find(b => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined
    if (!toolBlock) throw new Error('No synthesis result from Claude')

    // ── THE CRITICAL SANITIZATION LAYER ──────────────────────────────────────
    const rawData = toolBlock.input as Record<string, any>;
    
    // Set fallback primary contact
    const primaryContactName = rawData.ownership?.asset_manager?.name ?? validatedDMs[0]?.name ?? mgmt ?? property_name;

    // Force payload into the exact shape expected by the DB and UI
    const prospectPayload = {
      property: {
        name: property_name,
        address: address || location || property_name,
        units: null,
        property_type: rawData.ownership?.owner_type ?? 'Multifamily',
        class: null,
        year_built: null,
        management_company: mgmt || 'Unknown',
        owner_entity: rawData.ownership?.owner_entity ?? 'Unknown',
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
        title: rawData.ownership?.asset_manager?.title ?? validatedDMs[0]?.currentTitle ?? 'Executive',
        company: rawData.ownership?.asset_manager?.company ?? validatedDMs[0]?.company ?? mgmt,
        email: rawData.ownership?.asset_manager?.email ?? validatedDMs[0]?.email ?? '',
        phone: '',
        tenure_years: 0,
        top_email_format: '',
        linkedin_slug: validatedDMs[0]?.linkedinUrl?.split('/in/')?.[1] ?? ''
      },
      decision_maker_chain: validatedDMs.map(dm => ({
        name: dm.name,
        title: dm.currentTitle,
        company: dm.company,
        role_type: dm.isActiveCEO ? 'owner' : 'asset_manager',
        email: dm.email || '',
        top_email_format: '',
        linkedin_slug: dm.linkedinUrl?.split('/in/')?.[1] || ''
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

    // Persist to Intel DB
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
      query_interpretation: "ARIA Deep OSINT Aggregation",
      prospects: [prospectPayload], 
      fccVerified: edgarResults.length > 0 || permitResults.length > 0,
      webIntelligence: true
    })

  } catch (err: any) {
    console.error('[aria/research/deep]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}