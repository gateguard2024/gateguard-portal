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
 * Step 6: People     — PM, regional, asset manager, Apollo (~6s, 2 searches + Apollo)
 * Step 7: Synthesis  — Sonnet assembles into structured output (~8s)
 *
 * Total: ~38-48s | ~14 Tavily calls | ~$0.48/search
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
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.results ?? []).map((r: TavilyResult) => ({ ...r, source }))
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

async function fccBroadbandLookup(lat: number, lng: number): Promise<string[]> {
  try {
    const res = await fetch(
      `https://broadbandmap.fcc.gov/api/public/map/listAvailability?latitude=${lat.toFixed(6)}&longitude=${lng.toFixed(6)}&unit=location`,
      { headers: { 'User-Agent': 'GateGuard-ARIA/2.0' }, signal: AbortSignal.timeout(6000) }
    )
    if (!res.ok) return []
    const data = await res.json()
    const providers: Array<{ brand_name: string; technology: string }> = data?.results ?? data?.availability ?? []
    return [...new Set(
      providers
        .filter(p => p.technology && !['60', '70', '300', '400'].includes(String(p.technology)))
        .map(p => p.brand_name)
        .filter(Boolean)
    )]
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
  try {
    const res = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': process.env.APOLLO_API_KEY },
      body: JSON.stringify({ q_organization_name: company, person_titles: titles, person_locations: location ? [location] : [], per_page: 6 }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data?.people ?? []).slice(0, 6)
  } catch { return [] }
}

// ─── ProxyCurl (1 call max) ───────────────────────────────────────────────────

interface ProxycurlProfile { full_name?: string; occupation?: string; experiences?: Array<{ company?: string; title?: string; ends_at?: any }>; email?: string; personal_email?: string }

async function proxycurlProfile(linkedinUrl: string): Promise<ProxycurlProfile | null> {
  if (!process.env.PROXYCURL_API_KEY) return null
  try {
    const params = new URLSearchParams({ url: linkedinUrl, use_cache: 'if-recent', fallback_to_cache: 'on-error', skills: 'exclude', inferred_salary: 'exclude' })
    const res = await fetch(`https://nubela.co/proxycurl/api/v2/linkedin?${params}`, { headers: { Authorization: `Bearer ${process.env.PROXYCURL_API_KEY}` }, signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
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
  tech_generation: string
}
interface StepContact { name: string; title: string; company: string; role_type: string; email: string; phone: string; linkedin: string }
interface StepPeople {
  property_manager: StepContact | null; regional_manager: StepContact | null
  asset_manager: StepContact | null; all_contacts: StepContact[]; email_format: string
}

// ─── STEP 1: Identity ─────────────────────────────────────────────────────────

async function runStep1(name: string, hintCity: string, hintState: string, hintMgmt: string, client: Anthropic): Promise<StepIdentity> {
  const blank: StepIdentity = {
    name, address: '', city: hintCity, state: hintState, units: null, year_built: null,
    property_class: null, property_type: 'multifamily', website: '', phone: '', email: '',
    email_domain: '', management_company: hintMgmt, isp_hints: [], coords: null,
  }
  const geo = [hintCity, hintState].filter(Boolean).join(', ')

  const [listingResults, unitResults] = await Promise.all([
    tavilySearch(`"${name}" ${geo} apartments site:apartments.com OR site:rentcafe.com OR site:zillow.com`, 3, 'identity', 'basic', true),
    tavilySearch(`"${name}" ${geo} "units" OR "homes" "year built" OR "built in" apartments management`, 3, 'identity'),
  ])
  const allResults = [...listingResults, ...unitResults]
  const usable = allResults.filter(r => (r.raw_content || r.content)?.length > 40).slice(0, 8)
  if (usable.length === 0) return blank

  const snippets = usable.map((r, i) => {
    const text = r.raw_content ? r.raw_content.slice(0, 1000) : r.content.slice(0, 400)
    return `[${i + 1}] ${r.title}\nURL: ${r.url}\n${text}`
  }).join('\n\n---\n\n')

  const prompt = `Extract property facts. Return ONLY valid JSON:
{"name":"","address":"","city":"","state":"","units":null,"year_built":null,"property_class":null,"property_type":"multifamily","website":"","phone":"","email":"","email_domain":"","management_company":"","isp_hints":[]}
RULES: units=integer (look for "X units","X homes","X apartment homes"); year_built=4-digit integer; property_class="A","B", or "C" only; website=official URL; phone=leasing office number; email_domain=domain from email/website; management_company=ONLY if explicitly named; isp_hints=any internet provider named as included amenity; null for unknown numbers, empty string for unknown text`

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

  const [reviewResults, redditResults, internetResults, gateResults] = await Promise.all([
    tavilySearch(`${nameQ} ${geo} reviews internet wifi gate access problems site:apartmentratings.com OR site:apartments.com OR site:yelp.com`, 4, 'pain', 'advanced'),
    tavilySearch(`${nameQ} ${geo} internet OR wifi OR gate OR "access control" complaints site:reddit.com`, 3, 'pain'),
    tavilySearch(`${nameQ} ${geo} "no choice" OR "forced" OR "mandatory" OR "only option" internet wifi provider`, 3, 'pain', 'advanced'),
    tavilySearch(`${nameQ} ${geo} "gate broken" OR "gate down" OR "gate not working" OR "can't get in"`, 3, 'pain'),
  ])

  const allResults = [...reviewResults, ...redditResults, ...internetResults, ...gateResults]
  const usable = allResults.filter(r => r.content?.length > 60).slice(0, 14)
  if (usable.length === 0) return { ...blank, raw_excerpts: allResults }

  const snippets = usable.map((r, i) => `[${i + 1}] ${r.title}\n${r.content.slice(0, 400)}`).join('\n\n---\n\n')
  const extracted = await haikusExtract<Omit<StepPainSignals, 'raw_excerpts'>>(
    `Extract resident pain signals from reviews. Focus on: gate issues, internet/wifi problems, camera/security, management, crime, smart locks. Return ONLY valid JSON:
{"signals":[{"type":"gate","quote":"","source":"","date":"","severity":"high"}],"gate_issue_count":0,"internet_issue_count":0}
type options: "gate","internet","camera","crime","management","smart_lock","general"
quote: verbatim (max 120 chars). severity: high=safety/major failure, medium=recurring, low=minor.
Include up to 12 signals. Prefer last 6-12 months. ONLY negative signals.`,
    snippets, 800, client
  )
  return { ...(extracted || blank), raw_excerpts: allResults }
}

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

  const [bulkResults, ispResults, edgarResults] = await Promise.all([
    tavilySearch(`${nameQ} ${geo} "internet included" OR "bulk internet" OR "wifi included" OR "technology fee" OR "mandatory wifi" site:apartments.com OR site:rentcafe.com`, 3, 'isp', 'advanced'),
    tavilySearch(`${nameQ} ${geo} ${fccProviders.slice(0, 3).join(' OR ') || 'Comcast OR Spectrum OR "AT&T" OR Gigstreem OR Hotwire'} internet agreement OR provider`, 4, 'isp'),
    searchEdgar(name, entity).then(r => r.map(e => ({ ...e, source: 'EDGAR' } as TavilyResult))),
  ])

  const allResults = [...bulkResults, ...ispResults, ...edgarResults]
  const usable = allResults.filter(r => r.content?.length > 40).slice(0, 12)

  const portfolioCtx  = portfolioIspBlock  ? `\n\nPORTFOLIO ISP DB (high confidence):\n${portfolioIspBlock}` : ''
  const cacheCtx      = cachedDetections   ? `\n\nCACHED DETECTIONS:\n${cachedDetections}` : ''
  const findingsCtx   = priorFindings      ? `\n\nPRIOR FINDINGS:\n${priorFindings}` : ''
  const fccCtx        = fccProviders.length > 0 ? `\n\nFCC BROADBAND MAP (confirmed at address):\n${fccProviders.map(p => `• ${p}`).join('\n')}` : ''

  const snippets = usable.map((r, i) => `[${i + 1}] ${r.title}\n${r.content.slice(0, 400)}`).join('\n\n---\n\n')
  const extracted = usable.length > 0 ? await haikusExtract<StepConnectivity>(
    `Extract internet/video connectivity data. Return ONLY valid JSON:
{"isp_providers":[],"video_providers":[],"bulk_agreements":[],"mandatory_tech_fee":false,"fcc_providers":[],"bulk_detected":false,"provider_confirmed":false}
bulk_agreements: [{"provider":"","service_type":"internet","agreement_type":"bulk","confidence":"high","evidence":"","expiry_estimate":""}]
RULES: isp_providers = ONLY actual ISPs (never management company names); bulk_detected=true if internet included in rent or bulk/exclusive deal found; provider_confirmed=true if provider name is explicitly stated${portfolioCtx}${fccCtx}${cacheCtx}${findingsCtx}`,
    snippets, 500, client
  ) : null

  const result = extracted || blank
  result.fcc_providers = fccProviders
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
  const blank: StepPropTech = { gate_operators: [], access_control: [], intercoms: [], cameras: [], smart_locks: [], resident_apps: [], tech_generation: 'legacy' }
  const entity = mgmt || owner
  const hasGatePain = painSignals.some(s => s.type === 'gate')

  const [gateResults, accessResults, entityResults] = await Promise.all([
    tavilySearch(`"${name}" ${location} ${hasGatePain ? '"gate" "broken" OR "replaced" OR "installed"' : ''} DoorKing OR LiftMaster OR Viking OR Linear OR FAAC OR ButterflyMX OR Aiphone gate intercom access`, 4, 'proptech'),
    tavilySearch(`"${name}" ${location} Brivo OR Openpath OR HID OR SALTO OR Verkada OR Avigilon OR SmartRent OR GateWise OR Latch cameras security`, 4, 'proptech'),
    entity ? tavilySearch(`"${entity}" ButterflyMX OR DoorKing OR SmartRent OR Brivo OR LiftMaster portfolio standard`, 3, 'proptech') : Promise.resolve([] as TavilyResult[]),
  ])

  const usable = [...gateResults, ...accessResults, ...entityResults].filter(r => r.content?.length > 40).slice(0, 10)
  if (usable.length === 0) return blank

  const snippets = usable.map((r, i) => `[${i + 1}] ${r.title}\n${r.content.slice(0, 350)}`).join('\n\n---\n\n')
  const extracted = await haikusExtract<StepPropTech>(
    `Extract technology brands found. Return ONLY valid JSON:
{"gate_operators":[],"access_control":[],"intercoms":[],"cameras":[],"smart_locks":[],"resident_apps":[],"tech_generation":"legacy"}
Known brands — gates: DoorKing/LiftMaster/Viking/Linear/FAAC/PDK; access: Brivo/HID/SALTO/Openpath; intercoms: ButterflyMX/Aiphone/Viking/2N; cameras: Verkada/Avigilon/EagleEye/Hanwha; locks: SmartRent/GateWise/Latch/August/Yale
tech_generation: "legacy"=pre-2018, "modern"=2018+ cloud, "hybrid"=mix. Empty arrays if not found.`,
    snippets, 400, client
  )
  return extracted || blank
}

// ─── STEP 6: People ───────────────────────────────────────────────────────────

async function runStep6(
  name: string, city: string, state: string, mgmt: string, owner: string,
  emailDomain: string, painRawExcerpts: TavilyResult[], client: Anthropic
): Promise<StepPeople> {
  const blank: StepPeople = { property_manager: null, regional_manager: null, asset_manager: null, all_contacts: [], email_format: '' }
  const entity = mgmt || owner
  if (!entity) return blank
  const geo = [city, state].filter(Boolean).join(', ')

  const painSnippets = painRawExcerpts.filter(r => r.content?.length > 40).slice(0, 6)
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.content.slice(0, 300)}`).join('\n\n---\n\n')

  const [linkedinResults, apolloContacts] = await Promise.all([
    tavilySearch(`"${entity}" ${geo} "property manager" OR "community manager" OR "regional manager" site:linkedin.com`, 4, 'people'),
    apolloSearchContacts(entity, [
      'Property Manager', 'Community Manager', 'Leasing Manager',
      'Regional Property Manager', 'Regional Manager', 'Area Manager',
      'Asset Manager', 'Portfolio Manager', 'Vice President', 'Director',
      'Chief Executive Officer', 'CEO', 'President',
    ], geo),
  ])

  // ProxyCurl: validate top Apollo contact only (1 call max)
  const topWithLinkedin = apolloContacts.find(c => c.linkedin_url)
  let proxyProfile: ProxycurlProfile | null = null
  if (topWithLinkedin?.linkedin_url) proxyProfile = await proxycurlProfile(topWithLinkedin.linkedin_url)

  // Email format lookup
  let emailFormat = ''
  if (emailDomain) {
    const efResults = await tavilySearch(`"${emailDomain}" email format "firstname.lastname" OR "first.last" OR "flastname" site:rocketreach.co OR site:hunter.io`, 2, 'people')
    const efSnippets = efResults.filter(r => r.content?.length > 30).slice(0, 3).map(r => r.content.slice(0, 200)).join('\n')
    if (efSnippets) {
      const efResult = await haikusExtract<{ format: string }>(
        `Find the email format for domain "${emailDomain}". Return ONLY valid JSON: {"format":""}
Examples: "firstname.lastname@domain.com", "flastname@domain.com", "firstname@domain.com"`,
        efSnippets, 100, client)
      emailFormat = normStr(efResult?.format) || ''
    }
  }

  // Apollo contacts → typed
  const apolloTyped: StepContact[] = apolloContacts.slice(0, 6).map(c => {
    const tl = (c.title ?? '').toLowerCase()
    let role_type = 'corporate'
    if (tl.includes('property manager') || tl.includes('community manager') || tl.includes('leasing')) role_type = 'property_manager'
    else if (tl.includes('regional') || tl.includes('area manager')) role_type = 'regional_manager'
    else if (tl.includes('asset') || tl.includes('portfolio') || tl.includes('director') || tl.includes('vice president') || tl.includes('vp')) role_type = 'asset_manager'
    return {
      name: normStr(c.name) || '', title: normStr(c.title) || '',
      company: normStr(c.organization?.name) || entity, role_type,
      email: normStr(c.email) || '', phone: c.phone_numbers?.[0] || '',
      linkedin: c.linkedin_url || '',
    }
  })

  // Extract named contacts from web snippets
  const allSnippets = [painSnippets, ...linkedinResults.filter(r => r.content?.length > 40).slice(0, 6).map((r, i) => `[${i + 1}] ${r.title}\n${r.content.slice(0, 350)}`)].join('\n\n---\n\n')
  const webExtracted = allSnippets.length > 50
    ? await haikusExtract<{ contacts: StepContact[] }>(
        `Extract named individuals who work for "${entity}" as property managers, regional managers, or asset managers. Return ONLY valid JSON:
{"contacts":[{"name":"","title":"","company":"","role_type":"property_manager","email":"","phone":"","linkedin":""}]}
role_type: "property_manager"=on-site, "regional_manager"=multi-property, "asset_manager"=financial, "corporate"=C-suite
Only include people with actual names. Empty array if none found.`,
        allSnippets, 500, client)
    : null

  const webContacts: StepContact[] = (webExtracted?.contacts ?? []).filter(c => normStr(c.name) !== null)

  // Merge & deduplicate
  const allContacts = [...webContacts, ...apolloTyped].filter((c, idx, arr) =>
    c.name && arr.findIndex(x => x.name === c.name) === idx
  )

  // Update with ProxyCurl verified data
  if (proxyProfile && topWithLinkedin) {
    const currentExp = (proxyProfile.experiences ?? []).find(e => !e.ends_at)
    const idx = allContacts.findIndex(c => c.name === topWithLinkedin.name)
    if (idx >= 0) {
      if (proxyProfile.email || proxyProfile.personal_email) allContacts[idx].email = proxyProfile.email || proxyProfile.personal_email || allContacts[idx].email
      if (currentExp?.title) allContacts[idx].title = currentExp.title
    }
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

    // ── Step 1: Identity ──────────────────────────────────────────────────────
    const s1 = await runStep1(rawQuery, hintCity, hintState, hintMgmt, anthropic)
    const property_name = s1.name || rawQuery
    const address       = (raw.address as string) || s1.address || ''
    const city          = hintCity  || s1.city  || ''
    const state         = hintState || s1.state || ''
    const mgmt          = s1.management_company || ''
    const location      = [city, state].filter(Boolean).join(', ') || address || ''

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

    const owner    = normStr(s2.owner_entity) || ''
    const old_name = normStr(s2.old_name) || ''

    // ── Steps 3, 4, 5 in parallel ─────────────────────────────────────────────
    const [s3, s4, s5] = await Promise.all([
      runStep3(property_name, old_name, city, state, anthropic),
      runStep4(property_name, old_name, city, state, mgmt, owner, s1.coords, portfolioIspBlock, cachedDetectionsBlock, priorFindingsBlock, anthropic),
      runStep5(property_name, location, mgmt, owner, [], anthropic),
    ])

    // ── Step 4B: ISP Confirmation (only if bulk detected + provider unknown) ──
    if (s4.bulk_detected && !s4.provider_confirmed && (mgmt || owner)) {
      const conf = await runStep4b(property_name, mgmt, owner, s4.fcc_providers, anthropic)
      if (conf.confirmed_provider) {
        if (!s4.isp_providers.includes(conf.confirmed_provider)) s4.isp_providers.unshift(conf.confirmed_provider)
        s4.provider_confirmed = true
        if (s4.bulk_agreements.length === 0) {
          s4.bulk_agreements.push({ provider: conf.confirmed_provider, service_type: 'internet', agreement_type: 'bulk', confidence: 'high', evidence: conf.evidence })
        } else if (!s4.bulk_agreements[0].provider) {
          s4.bulk_agreements[0].provider = conf.confirmed_provider
        }
      }
    }

    // ── Step 6: People ────────────────────────────────────────────────────────
    const s6 = await runStep6(property_name, city, state, mgmt, owner, s1.email_domain, s3.raw_excerpts, anthropic)

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
4. bulk_agreements: copy from STEP 4 — already structured
5. proptech fields: copy from STEP 5
6. extracted_contacts: use STEP 6 — property_manager first, then regional, then asset manager
7. pain_signals: use STEP 3 signals — up to 12, last 6-12 months
8. ownership: copy from STEP 2
9. If management_company blank but owner is a RE firm → set management_company = owner_entity

CONTACT PRIORITY: Property Manager > Regional Manager > Asset Manager > CEO

key_finding: "[WHO] at [company] controls this. [WHY NOW: pain signal / contract expiry / acquisition / aging tech]"
pitch_strategy.primary_hook: one sentence using THIS property's specific pain signal
freshness_score (1-5): 5=contract expiry this year; 4=pain complaints <6mo; 3=listing confirmed; 2=older data; 1=inference`,
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
        name:             normStr(bestContact?.name || fallback.name) ?? mgmt ?? property_name,
        title:            normStr(bestContact?.title || fallback.title) ?? 'Executive',
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
        primary_concern:     normStr(rawData.key_finding?.slice(0, 80)) ?? 'No critical vulnerabilities detected',
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
        results: { mode: 'deep', prospects: [prospectPayload], fccVerified: s4.fcc_providers.length > 0, webIntelligence: true },
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
      query_interpretation: old_name ? `"${property_name}" (formerly "${old_name}")` : `ARIA v2 Intel — ${property_name}`,
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
      },
      fccVerified: s4.fcc_providers.length > 0,
      webIntelligence: true,
    })

  } catch (err: any) {
    console.error('[aria/research/deep]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
