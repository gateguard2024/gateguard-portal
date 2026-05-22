/**
 * POST /api/aria/research
 *
 * ARIA — Lead Intelligence Engine
 * Returns property intel, decision maker, intent signals, psychographic profile,
 * and 3 hyper-personalized email variants with predicted reply rates.
 *
 * Connectivity intel pipeline (runs before Claude):
 *   1. Extract location hint from query (address or city/state)
 *   2. Geocode via Nominatim (OpenStreetMap) — no API key required
 *   3. Query FCC Broadband Map API for verified ISP coverage at that location
 *   4. Run 4 parallel Tavily OSINT searches (listing sites, Reddit/reviews, county deeds, ISP partnerships)
 *   5. Inject FCC + Tavily web intelligence as hard facts into Claude's prompt
 *
 * Accuracy targets:
 *   - ISP availability: ~95% (FCC 477 data, updated twice yearly)
 *   - Video provider: ~75% (FCC + AI inference)
 *   - Bulk/exclusive agreements: ~80% with Tavily OSINT (listing sites + county deeds are high-signal)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── Tavily OSINT helper ───────────────────────────────────────────────────

interface TavilyResult { title: string; url: string; content: string; score: number; source?: string }

async function tavilySearch(query: string, maxResults = 4, source = 'web'): Promise<TavilyResult[]> {
  if (!process.env.TAVILY_API_KEY) return []
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.TAVILY_API_KEY}` },
      body: JSON.stringify({ query, search_depth: 'basic', max_results: maxResults, include_answer: false, include_raw_content: false, include_images: false }),
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.results ?? []).map((r: TavilyResult) => ({ ...r, source }))
  } catch { return [] }
}

// ─── FCC / Geocoding helpers ───────────────────────────────────────────────

interface GeoResult { lat: number; lng: number; display: string }
interface FCCProvider { brand_name: string; holding_company: string; technology: number; max_download_speed: number; max_upload_speed: number }

/**
 * Geocode a free-text location string to lat/lng using Nominatim (OpenStreetMap).
 * No API key required. Returns null on failure.
 */
async function geocodeLocation(location: string): Promise<GeoResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1&addressdetails=0&countrycodes=us`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'GateGuard-ARIA/1.0 (rfeldman@gateguard.co)' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name }
  } catch {
    return null
  }
}

/**
 * Query the FCC Broadband Map API for ISP coverage at a lat/lng point.
 * Returns up to 25 providers. Filters to fixed broadband (tech codes that matter for MDU):
 *   10=DSL, 40=Cable, 50=Fiber, 60=Satellite, 300=Licensed Fixed Wireless, 70=Cable
 * Docs: https://broadbandmap.fcc.gov/home (public, no auth)
 */
async function fetchFCCBroadband(lat: number, lng: number): Promise<FCCProvider[]> {
  try {
    const url = new URL('https://broadbandmap.fcc.gov/api/public/map/listAvailability')
    url.searchParams.set('latitude', lat.toFixed(6))
    url.searchParams.set('longitude', lng.toFixed(6))
    url.searchParams.set('unit', '')
    url.searchParams.set('category', 'Residential')
    url.searchParams.set('addr', '')
    url.searchParams.set('city', '')
    url.searchParams.set('state', '')
    url.searchParams.set('zip', '')
    url.searchParams.set('speed', '25')
    url.searchParams.set('tech', '300')
    url.searchParams.set('limit', '25')
    url.searchParams.set('offset', '0')

    const res = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json', 'User-Agent': 'GateGuard-ARIA/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const json = await res.json()
    const providers: FCCProvider[] = json?.data ?? []
    // Deduplicate by brand_name; filter out satellite (tech 60) for wired analysis
    const seen = new Set<string>()
    return providers.filter(p => {
      if (p.technology === 60) return false // satellite — not relevant for MDU bulk deals
      if (seen.has(p.brand_name)) return false
      seen.add(p.brand_name)
      return true
    })
  } catch {
    return []
  }
}

/**
 * Try to extract a geocodable location from the user's query.
 * Works for: specific addresses, "apartments in Atlanta", "Greystar Dallas", etc.
 * Returns the best location string to geocode, or null if no location detected.
 */
function extractLocationHint(query: string): string | null {
  // City/state patterns: "in Atlanta", "Dallas TX", "Phoenix, Arizona"
  const cityStateRe = /(?:in|at|near|around)?\s*([A-Z][a-zA-Z\s]+(?:,\s*[A-Z]{2}|,\s*[A-Za-z]+))/
  const m = query.match(cityStateRe)
  if (m) return m[1].trim()

  // ZIP code
  const zipRe = /\b(\d{5}(?:-\d{4})?)\b/
  const zm = query.match(zipRe)
  if (zm) return zm[1]

  // State-only: "Florida", "Texas"
  const states = ['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware',
    'Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana',
    'Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana',
    'Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina',
    'North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina',
    'South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia',
    'Wisconsin','Wyoming']
  for (const s of states) {
    if (query.toLowerCase().includes(s.toLowerCase())) return `${s}, USA`
  }

  return null
}

const KNOWN_MGMT_COS = ['greystar','lincoln property','bozzuto','maa','aimco','cortland','equity residential','avalon','avalonbay','camden','national','rpm living','cardinal group','grayco','windsor']

function extractSearchTerms(query: string): string {
  const q = query.toLowerCase()
  for (const co of KNOWN_MGMT_COS) {
    if (q.includes(co)) return co.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
  }
  // Return first 60 chars of the query as fallback
  return query.trim().slice(0, 60)
}

/**
 * Format FCC provider list into a human-readable block for Claude's prompt.
 * Groups by technology type so Claude can identify cable-only markets (higher bulk deal risk).
 *
 * CRITICAL: FCC data = "ISP is licensed/capable of serving this area."
 * It does NOT indicate that any ISP has a bulk, MDU, or exclusive deal with a specific property.
 * Local/regional ISPs that don't appear in Claude's training data may still be the bulk provider.
 */
function formatFCCDataForPrompt(providers: FCCProvider[], location: string): string {
  if (providers.length === 0) return ''

  const byTech: Record<string, string[]> = {}
  const techLabel: Record<number, string> = {
    10: 'DSL', 11: 'DSL', 12: 'DSL', 20: 'DSL',
    40: 'Cable', 41: 'Cable', 42: 'Cable',
    50: 'Fiber', 300: 'Fixed Wireless', 70: 'Cable',
  }
  for (const p of providers) {
    const tech = techLabel[p.technology] ?? 'Other'
    if (!byTech[tech]) byTech[tech] = []
    const name = p.brand_name || p.holding_company
    if (!byTech[tech].includes(name)) byTech[tech].push(name)
  }

  const lines = [
    `FCC BROADBAND MAP DATA — ISPs licensed to serve the area near ${location}:`,
    `(Source: FCC Form 477 / Broadband Map API, updated biannually)`,
    `⚠ CRITICAL DISTINCTION: This data means each ISP CAN serve this area. It does NOT mean any ISP has`,
    `  a bulk/MDU/exclusive deal with any specific property. Local or regional ISPs not on this list`,
    `  may still be the actual bulk provider. Use only for isp_providers[] availability — NEVER infer`,
    `  bulk_agreements[] from FCC data alone.`,
  ]
  for (const [tech, names] of Object.entries(byTech)) {
    lines.push(`  ${tech}: ${names.join(', ')}`)
  }

  // Flag cable-only markets — increases probability but does NOT confirm a bulk deal
  const hasFiber = !!byTech['Fiber']?.length
  const hasCable = !!byTech['Cable']?.length
  const hasOnlyCable = hasCable && !hasFiber
  if (hasOnlyCable) {
    lines.push(`  ⚠ CABLE-ONLY MARKET: No fiber ISP licensed in area. When combined with OTHER evidence (resident reviews,`)
    lines.push(`    listing sites, management company statements), cable exclusivity is more plausible — but FCC data`)
    lines.push(`    alone is NOT sufficient to set bulk_agreements[]. Set confidence="low" without corroborating text.`)
  } else if (hasFiber && hasCable) {
    lines.push(`  FIBER + CABLE MARKET: Multiple ISP types present. A local/regional fiber ISP may have an MDU deal`)
    lines.push(`  even if not the largest national carrier. Do not assume the biggest-name ISP has the bulk deal.`)
  }

  // Flag DirecTV / AT&T presence (ATLAS pitch opportunity)
  const allNames = providers.map(p => (p.brand_name + ' ' + p.holding_company).toLowerCase())
  if (allNames.some(n => n.includes('at&t') || n.includes('directv') || n.includes('att '))) {
    lines.push(`  AT&T / DirecTV licensed in this market — ATLAS bundle pitch may apply if confirmed at property.`)
  }

  return lines.join('\n')
}

// ─── Tool schema ──────────────────────────────────────────────────────────

// Tool schema — forces Claude to return structured data via tool_use, eliminating
// all manual JSON parsing and escaping issues.
const ariaResearchTool: Anthropic.Tool = {
  name: 'aria_research_result',
  description: 'Return the ARIA lead intelligence research result.',
  input_schema: {
    type: 'object' as const,
    required: ['mode', 'query_interpretation', 'prospects'],
    properties: {
      mode: { type: 'string', enum: ['target', 'prospect'] },
      query_interpretation: { type: 'string' },
      prospects: {
        type: 'array',
        items: {
          type: 'object',
          required: ['property', 'decision_maker', 'pain_signals', 'profile', 'email_variants', 'generic_reply_rate'],
          properties: {
            property: {
              type: 'object',
              required: ['name', 'address', 'units', 'year_built', 'management_company', 'owner_entity', 'property_type', 'class', 'occupancy', 'isp_providers', 'video_providers', 'bulk_agreements', 'proptech'],
              properties: {
                name:               { type: 'string' },
                address:            { type: 'string' },
                units:              { type: 'number' },
                year_built:         { type: 'number' },
                management_company: { type: 'string' },
                owner_entity:       { type: 'string' },
                property_type:      { type: 'string' },
                class:              { type: 'string' },
                occupancy:          { type: 'string' },
                isp_providers: {
                  type: 'array',
                  description: 'ISPs currently serving this property (populate from FCC data if provided, otherwise infer)',
                  items: { type: 'string' },
                },
                video_providers: {
                  type: 'array',
                  description: 'Video/TV providers currently serving this property (DirecTV, Comcast, Spectrum, etc.)',
                  items: { type: 'string' },
                },
                bulk_agreements: {
                  type: 'array',
                  description: 'Known exclusive or bulk internet/video agreements — provider, type, and estimated expiry if known',
                  items: {
                    type: 'object',
                    required: ['provider', 'service_type', 'agreement_type', 'expiry_estimate', 'confidence'],
                    properties: {
                      provider:        { type: 'string' },
                      service_type:    { type: 'string', enum: ['internet', 'video', 'bundled'] },
                      agreement_type:  { type: 'string', enum: ['exclusive', 'bulk', 'preferred', 'unknown'] },
                      expiry_estimate: { type: 'string', description: 'e.g. "Q2 2026", "~2027", "unknown"' },
                      confidence:      { type: 'string', enum: ['high', 'medium', 'low'] },
                    },
                  },
                },
                proptech: {
                  type: 'object',
                  description: 'Current property technology stack — gates, access control, cameras, smart locks, resident apps',
                  required: ['gate_operators','access_control','intercoms','cameras','smart_locks','resident_apps','package_solutions','tech_generation','sara_signals','displacement_targets'],
                  properties: {
                    gate_operators:     { type: 'array', items: { type: 'string' }, description: 'Gate operator brands (LiftMaster, DoorKing, Viking, Linear, FAAC, BFT, LiftMaster SL3000, etc.)' },
                    access_control:     { type: 'array', items: { type: 'string' }, description: 'Access control platforms (Brivo, HID, Lenel, Openpath, PDK, Genetec, Allegion, etc.)' },
                    intercoms:          { type: 'array', items: { type: 'string' }, description: 'Intercom/video entry systems (ButterflyMX, 2N, DoorKing, Aiphone, Doorbird, Verkada, etc.)' },
                    cameras:            { type: 'array', items: { type: 'string' }, description: 'Camera/CCTV vendors (Axis, Hanwha, Eagle Eye, Avigilon, Hikvision, Milestone, Verkada, etc.)' },
                    smart_locks:        { type: 'array', items: { type: 'string' }, description: 'Smart lock brands (Schlage, Yale, August, Latch, Kisi, Allegion, etc.)' },
                    resident_apps:      { type: 'array', items: { type: 'string' }, description: 'Resident-facing apps (SmartRent, Latch, ButterflyMX, Brivo Mobile, Openpath, etc.)' },
                    package_solutions:  { type: 'array', items: { type: 'string' }, description: 'Package/delivery solutions (Package Concierge, Luxer One, Parcel Pending, Amazon Hub, etc.)' },
                    tech_generation:    { type: 'string', enum: ['legacy','modern','hybrid'], description: 'Overall tech generation assessment' },
                    sara_signals:       { type: 'boolean', description: 'Evidence this property/mgmt co uses SARA Plus / AT&T indirect channel' },
                    replacement_window: { type: 'string', description: 'When is major hardware refresh likely due? e.g. "2025-2026", "overdue", "3-5 years"' },
                    displacement_targets: { type: 'array', items: { type: 'string' }, description: 'Specific systems GateGuard can displace or integrate with at this property' },
                  },
                },
              },
            },
            decision_maker: {
              type: 'object',
              required: ['name', 'title', 'company', 'role_type', 'linkedin_slug', 'email', 'email_confidence', 'phone', 'tenure_years'],
              properties: {
                name:             { type: 'string' },
                title:            { type: 'string' },
                company:          { type: 'string' },
                role_type:        { type: 'string', enum: ['asset_manager','regional_manager','property_manager','owner','unknown'], description: 'Hierarchy role — asset_manager is highest priority target' },
                linkedin_slug:    { type: 'string' },
                email:            { type: 'string' },
                email_confidence: { type: 'number' },
                phone:            { type: 'string' },
                tenure_years:     { type: 'number' },
              },
            },
            decision_maker_chain: {
              type: 'array',
              description: 'Full chain of decision makers from owner/asset manager down to property manager. Most powerful listed first.',
              items: {
                type: 'object',
                required: ['name', 'title', 'company', 'role_type', 'email', 'email_confidence'],
                properties: {
                  name:             { type: 'string' },
                  title:            { type: 'string' },
                  company:          { type: 'string' },
                  role_type:        { type: 'string', enum: ['owner','asset_manager','regional_manager','property_manager','unknown'] },
                  linkedin_slug:    { type: 'string', description: 'LinkedIn profile slug or empty string' },
                  email:            { type: 'string' },
                  email_confidence: { type: 'number', description: '0.0–1.0' },
                  phone:            { type: 'string' },
                  notes:            { type: 'string', description: 'Why this person matters (e.g. "controls capex for 12-property portfolio")' },
                },
              },
            },
            ownership: {
              type: 'object',
              description: 'Property ownership and investment structure — who actually controls capex',
              required: ['owner_entity', 'owner_type', 'portfolio_size', 'acquisition_year'],
              properties: {
                owner_entity:    { type: 'string', description: 'Legal owner name (e.g. "Blackstone Real Estate", "Morgan Properties", "Smith Family Trust")' },
                owner_type:      { type: 'string', enum: ['private_equity', 'reit', 'family_office', 'individual', 'management_company_owned', 'unknown'] },
                portfolio_size:  { type: 'string', description: 'Approx units owned by this entity if known (e.g. "12,000 units across Southeast")' },
                acquisition_year: { type: 'string', description: 'Year owner acquired this property if known, or "unknown"' },
                hold_period:     { type: 'string', description: 'Expected hold period / disposition timeline if known' },
                capex_signal:    { type: 'string', description: 'Any evidence of recent or planned capital investment (renovation, refinancing, acquisition)' },
              },
            },
            pain_signals: {
              type: 'array',
              items: {
                type: 'object',
                required: ['source', 'date', 'signal_type', 'quote', 'severity'],
                properties: {
                  source:      { type: 'string' },
                  date:        { type: 'string' },
                  signal_type: { type: 'string' },
                  quote:       { type: 'string' },
                  severity:    { type: 'number' },
                },
              },
            },
            profile: {
              type: 'object',
              required: ['buy_score', 'urgency', 'primary_concern', 'current_vendor', 'contract_window', 'communication_style'],
              properties: {
                buy_score:           { type: 'number' },
                urgency:             { type: 'string', enum: ['high', 'medium', 'low'] },
                primary_concern:     { type: 'string' },
                current_vendor:      { type: 'string' },
                contract_window:     { type: 'string' },
                communication_style: { type: 'string' },
              },
            },
            email_variants: {
              type: 'array',
              items: {
                type: 'object',
                required: ['angle', 'subject', 'body', 'predicted_reply_rate', 'tone'],
                properties: {
                  angle:                { type: 'string' },
                  subject:              { type: 'string' },
                  body:                 { type: 'string' },
                  predicted_reply_rate: { type: 'number' },
                  tone:                 { type: 'string' },
                },
              },
            },
            generic_reply_rate: { type: 'number' },
          },
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

    const { query } = await req.json()
    if (!query?.trim()) return NextResponse.json({ error: 'query required' }, { status: 400 })

    // ── Step 1: Extract search context ──
    const locationHint = extractLocationHint(query) ?? ''
    const searchTerms = extractSearchTerms(query)

    // ── Step 2: All pre-research in parallel ──
    let fccBlock = ''
    let fccProvidersForUI: string[] = []
    let existingOppNames: string[] = []
    let tavilyContextBlock = ''

    const fccPromise = (async () => {
      if (!locationHint) return
      const geo = await geocodeLocation(locationHint)
      if (!geo) return
      const providers = await fetchFCCBroadband(geo.lat, geo.lng)
      if (providers.length === 0) return
      fccBlock = formatFCCDataForPrompt(providers, locationHint)
      fccProvidersForUI = [...new Set(providers.map(p => p.brand_name || p.holding_company))]
    })()

    const oppPromise = (async () => {
      try {
        const user  = await getCurrentUser()
        const scope = await resolveOrgScope(user)
        let oppQuery = supabase
          .from('opportunities')
          .select('account_name')
          .not('stage', 'in', '(lost,won)')
          .not('account_name', 'is', null)
          .limit(200)
        if (!scope.all && scope.ids.length > 0) {
          oppQuery = oppQuery.in('dealer_org_id', scope.ids)
        }
        const { data: opps } = await oppQuery
        existingOppNames = (opps ?? []).map((o: any) => o.account_name).filter(Boolean)
      } catch { /* non-blocking */ }
    })()

    // Tavily OSINT searches — run in parallel (non-blocking if no API key)
    const tavilyPromise = (async () => {
      if (!process.env.TAVILY_API_KEY) return
      const loc = locationHint || ''
      const terms = searchTerms
      const [listingSites, socialSignals, countyRecords, mduAnnouncements] = await Promise.all([
        // 1. Listing sites — most reliable for confirming "internet included" + provider name
        tavilySearch(`"${terms}" ${loc} "internet included" OR "bulk internet" OR "fiber included" OR "internet by" OR "Comcast included" OR "Spectrum included" OR "AT&T included" site:apartments.com OR site:apartmentlist.com OR site:rent.com OR site:zillow.com OR site:apartmentratings.com`, 4, 'listing-site'),
        // 2. Reddit/reviews — "only option" language confirms exclusive bulk deals
        tavilySearch(`"${terms}" ${loc} internet "only option" OR "can't use another" OR "forced to use" OR "included in rent" OR "only ISP" OR "building internet" site:reddit.com OR site:apartmentratings.com OR site:yelp.com`, 4, 'social'),
        // 3. County deed / easement records — ISPs record MDU agreements as easements on property title
        tavilySearch(`${loc} apartment MDU broadband "memorandum of agreement" OR "right of entry" OR "easement" OR "bulk service agreement" internet provider county deed recorder`, 3, 'county-deed'),
        // 4. ISP MDU partnership announcements + contract signals
        tavilySearch(`"${terms}" OR "${loc}" multifamily MDU "exclusive agreement" OR "bulk broadband" OR "community internet" OR "preferred provider" OR "agreement expires" internet provider partnership`, 3, 'isp-partnership'),
      ])

      const allResults = [...listingSites, ...socialSignals, ...countyRecords, ...mduAnnouncements]
        .filter(r => r.score > 0.25)
        .sort((a, b) => {
          const aBoost = ['listing-site','county-deed'].includes(a.source ?? '') ? 0.2 : 0
          const bBoost = ['listing-site','county-deed'].includes(b.source ?? '') ? 0.2 : 0
          return (b.score + bBoost) - (a.score + aBoost)
        })
        .slice(0, 12)

      if (allResults.length === 0) return

      const sourceLabels: Record<string, string> = {
        'listing-site': 'LISTING-SITE', social: 'REDDIT/REVIEW',
        'county-deed': 'COUNTY-DEED', 'isp-partnership': 'ISP-PARTNERSHIP', web: 'WEB',
      }

      tavilyContextBlock = `\n\nWEB INTELLIGENCE — Live search results (use as primary evidence for bulk_agreements[] and isp_providers[]):
${allResults.map((r, i) => `[${sourceLabels[r.source ?? 'web'] ?? 'WEB'}] ${r.title}\nURL: ${r.url}\n${r.content.slice(0, 400)}`).join('\n\n---\n\n')}

KEY SIGNALS TO EXTRACT FROM ABOVE:
- Listing site says "internet by [ISP]" or "bulk internet included" → bulk_agreements with that provider, confidence="medium"
- Reddit/review says "only option is [ISP]" or "can't use anyone else" → agreement_type="exclusive", confidence="medium"
- County deed/easement names ISP with term dates → confidence="high", use dates for expiry_estimate
- Any local/regional ISP mentioned (Gigastream, Sonic, Hotwire, WideOpenWest, Vyve, Metronet, Brightspeed, Ting, Consolidated) → TRUST IT over national carrier — these are often the actual MDU provider
- "memorandum of agreement" with term length → calculate expiry_estimate
- If NO web evidence found above → bulk_agreements = [] (never infer from market patterns alone)`
    })()

    await Promise.allSettled([fccPromise, oppPromise, tavilyPromise])

    const existingNamesBlock = existingOppNames.length > 0
      ? `\n\nEXCLUSION LIST — these properties are already active in our CRM pipeline. Do NOT suggest any of these as prospects:\n${existingOppNames.map(n => `- ${n}`).join('\n')}\n`
      : ''

    // ── Step 3: Build FCC context block for Claude ──
    const fccContextBlock = fccBlock
      ? `\n\n${fccBlock}\n\nIMPORTANT — FCC DATA USAGE RULES:\n1. Use FCC data for isp_providers[] (which ISPs cover this area). Do NOT invent ISPs not in this list.\n2. FCC data does NOT tell you which ISP has a bulk/MDU/exclusive deal with a specific property.\n3. Do NOT populate bulk_agreements[] based on FCC data alone.\n4. bulk_agreements[] requires explicit evidence: listing description, resident review, management company statement, or property website saying "internet included" or naming a specific provider.\n5. A local or regional ISP NOT on the FCC list could be the actual bulk provider (they may serve the property under a private MDU contract without FCC 477 coverage filing).\n6. Set confidence="low" on any bulk agreement inferred from FCC data + property class alone. "medium" requires one corroborating source. "high" requires explicit text evidence.\n`
      : `\n\nNOTE: FCC broadband data unavailable for this query (no location resolved). Use your best knowledge of typical ISP coverage in the target market. Apply strict confidence rules for bulk_agreements[].\n`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      tools: [ariaResearchTool],
      tool_choice: { type: 'tool', name: 'aria_research_result' },
      system: `You are ARIA, GateGuard's AI marketing intelligence engine for multifamily property sales.

TARGETING LOGIC:
- Always return exactly 1 prospect regardless of query type
- Specific property/address → use that property
- General area/company → pick the best single target

BREVITY RULES (critical for performance):
- pain_signals: exactly 3 items
- email_variants: exactly 3 items
- Email body: 4 sentences max. NO line breaks inside body string.
- Pain signal quote: under 80 chars, no line breaks

QUALITY STANDARDS:
- Property names should sound like real Atlanta/Dallas/Phoenix/Denver communities (e.g. "The Preserve at Sandy Springs", "Avalon Midtown", "Reserve at Legacy Park")
- Pain signal quotes must sound like real residents wrote them — gritty, specific, first person
- Email bodies: use the actual decision_maker.name (not [Name]). Reference the actual property.name. Reference an actual pain signal.
- Buy scores: realistic range 6.5–9.2
- Email body format: "Hi [name], [pain signal reference + property name]. [GateGuard solution]. [specific metric]. [soft CTA]. Best, Russel Feldman | GateGuard"

DECISION MAKER HIERARCHY (critical — target the right person):
GateGuard sells access control capex. Decisions are made by ASSET MANAGERS and OWNERS, not property managers.
The correct decision maker chain from most to least powerful:
1. ASSET MANAGER — The person at the investment firm/owner who controls capex budget. Title: "Asset Manager", "VP Asset Management", "Director of Asset Management", "Portfolio Manager". This is the FIRST EMAIL TARGET.
2. REGIONAL MANAGER / VP — Oversees 5–20+ properties for a management company. Can approve vendor changes. Title: "Regional Manager", "Regional Property Manager", "Vice President of Operations", "Director of Properties".
3. PROPERTY MANAGER — Day-to-day manager of a single property. Can flag issues and recommend vendors but rarely approves capex alone. Title: "Property Manager", "Community Manager", "General Manager".

DECISION MAKER RESEARCH RULES:
- For decision_maker: prioritize the ASSET MANAGER (ownership side) if you can identify them. If the property is owned by a REIT, private equity firm, or family office, look for the VP/Director of Asset Management or Portfolio Manager at the owner entity.
- If the management company is the target: identify the REGIONAL MANAGER, not the on-site property manager.
- Management companies to know: Greystar (regional VPs on LinkedIn), Equity Residential (asset management team), MAA, AvalonBay (asset managers), Aimco, Cortland, Lincoln Property Company, RPM Living, Bozzuto.
- Private equity/REIT owners: Morgan Properties, Blackstone, Starwood, Brookfield, KKR, JBG Smith — their asset managers control capex.
- email field: for asset managers, format is typically firstname.lastname@[ownerfirm].com or firstname@[managementco].com
- email_confidence: 0.95 for confirmed LinkedIn/company site, 0.70 for format-inferred, 0.50 for guessed

BULK AGREEMENT RESEARCH (CRITICAL ACCURACY RULES — READ CAREFULLY):
⚠ FCC BROADBAND DATA = ISP AREA COVERAGE ONLY. Never use FCC data to infer a bulk/MDU deal.
- bulk_agreements[] must have explicit evidence. Required sources: apartment listing descriptions ("internet included"), resident reviews ("only option is Spectrum"), property website, management company statement.
- WEB INTELLIGENCE (provided below as [LISTING-SITE], [REDDIT/REVIEW], [COUNTY-DEED], [ISP-PARTNERSHIP] excerpts): When present, these are HIGHER PRIORITY than FCC data for bulk agreements. A listing site saying "internet by X" is explicit evidence. A Reddit post saying "only option is X" implies exclusivity.
- COUNTY DEED signals: If a [COUNTY-DEED] source mentions an ISP name + agreement/memorandum + dates → this is the strongest possible evidence for bulk_agreements[] → set confidence="high" and extract expiry_estimate from the term length.
- OSINT hierarchy for bulk_agreements confidence: county-deed=high > listing-site=medium-high > social-"only option"=medium > FCC-pattern=low
- Local/regional ISPs (e.g. Gigastream, Sonic, Hotwire, WideOpenWest, Vyve, IgLou, Blue Ridge) frequently have MDU deals with properties even when not the area's dominant ISP. Do NOT ignore these.
- Do NOT default to Spectrum/Comcast/AT&T as the bulk provider just because they are the dominant carrier in the area. The actual bulk provider may be a local ISP you have less training data on.
- If you cannot identify a specific bulk provider from evidence, set bulk_agreements = [] (empty). It is better to return no bulk agreement than to guess incorrectly.
- confidence levels:
  * "high" = source TEXT explicitly says "internet included", "exclusive", "bulk deal", or names a specific provider as the building's only/preferred option; OR county deed names ISP with agreement dates
  * "medium" = source implies it with phrases like "everyone here uses X", "building deal", "can't use any other ISP"; OR listing site says "internet by [ISP]"
  * "low" = inferred from market patterns alone with no property-specific evidence
- When in doubt about the bulk provider: SET confidence="low" AND note in expiry_estimate: "unconfirmed"

ISP & VIDEO PROVIDER RESEARCH:
- If FCC broadband data is provided below, use ONLY those ISPs for isp_providers[]. This is verified government data, not inference.
- For video_providers: FCC 477 does not cover video. Research which video/TV providers serve the property.
- EMAIL ANGLE RULE — ISP/VIDEO INTEL:
  * If a bulk agreement expiry is within 18 months → use "contract_window" email angle
  * If property is on Comcast/Spectrum exclusively but AT&T Fiber is in the FCC data → use "upgrade path" angle
  * If DirecTV explicitly mentioned → use ATLAS MDU pitch angle

PROPTECH STACK RESEARCH (required for every prospect):
- Gate operators: identify current gate brand from job listings, resident complaints ("the LiftMaster broke again"), permit filings, management company vendor standards. DoorKing = highest SARA Bridge signal.
- Access control: look for Brivo, HID, Openpath, PDK, Lenel, Genetec. Management companies standardize — Greystar often uses Brivo, Equity uses Openpath, MAA uses various.
- Intercoms: ButterflyMX = modern competitor. 2N, Aiphone, DoorKing audio = legacy. No video intercom = GateGuard install opportunity.
- Cameras: Eagle Eye = direct integration available. Verkada, Avigilon = potential displacement. Analog/DVR = upgrade opportunity.
- Smart locks: Latch = direct competitor. Schlage/Yale legacy = GateCard integration opportunity. No smart lock = new install.
- Resident apps: SmartRent and Latch are competitors. No resident app = GateCard virgin territory.
- tech_generation: 'legacy' if gates/intercoms are >7 years, analog cameras, no resident app. 'modern' if ButterflyMX/Latch/SmartRent present, IP cameras, cloud access. 'hybrid' = mix.
- sara_signals: true if management company or property is known to be in AT&T indirect channel, or if DoorKing gates + DirecTV is present.

EMAIL ANGLE RULES — PROPTECH:
- sara_signals=true → SARA Bridge migration angle: "Your team is already in the AT&T ecosystem..."
- tech_generation='legacy' → urgency: "Residents are choosing communities based on tech. Here's the gap."
- ButterflyMX or Latch detected → competitive displacement angle
- No resident_apps → GateCard intro angle
- Asset manager is target → focus on NOI impact, liability reduction, resident retention metrics — not tech features`,

      messages: [{
        role: 'user',
        content: `ARIA research query: "${query.trim()}"
${existingNamesBlock}${fccContextBlock}${tavilyContextBlock}
GateGuard offerings to weave into emails where relevant:
- Gate operators, access control (Brivo), intercoms, cameras — full stack install
- Visitor management: GateCard platform — resident app, mobile access, delivery management
- DirecTV/AT&T MDU bulk TV + internet for whole building (ATLAS bundle)
- The Elevate Model: $10/unit/mo GateGuard cost → $150/yr resident fee → $30/unit/yr net profit for property
- SARA Bridge: easy migration path from SARA Plus

${fccBlock ? 'The FCC data above is already resolved for this location. Use it directly for isp_providers[]. Do NOT override it with your own inference.' : 'No FCC data available. Infer ISPs from your knowledge of the target market.'}
${tavilyContextBlock ? 'Web Intelligence results are provided above. Use [LISTING-SITE], [COUNTY-DEED], and [REDDIT/REVIEW] excerpts as primary evidence for bulk_agreements[]. These are live search results, prioritize them over pattern inference.' : ''}

Call the aria_research_result tool with your findings now.`
      }]
    })

    const toolBlock = message.content.find(b => b.type === 'tool_use') as
      Anthropic.ToolUseBlock | undefined

    if (!toolBlock) throw new Error('Claude did not call the aria_research_result tool — try again')

    const data = toolBlock.input as { mode: string; query_interpretation: string; prospects: any[] }

    if (!Array.isArray(data.prospects) || data.prospects.length === 0) {
      throw new Error('No prospects in response — try rephrasing your query')
    }

    // Annotate ISP data source on each prospect so the UI can show the FCC badge
    if (fccProvidersForUI.length > 0) {
      data.prospects.forEach(p => {
        p.property._fcc_verified = true
        p.property._fcc_providers = fccProvidersForUI
      })
    }

    // Save search to DB (non-blocking — never let this fail the response)
    let savedSearchId: string | null = null
    try {
      const user  = await getCurrentUser()
      const scope = await resolveOrgScope(user)
      const org_id = scope.own_id ?? null
      const { data: saved } = await supabase
        .from('aria_searches')
        .insert({
          org_id,
          user_id:    user?.id ?? null,
          user_name:  user ? user.name || user.email || null : null,
          user_email: user?.email ?? null,
          search_type: 'base',
          query: query.trim(),
          query_interpretation: data.query_interpretation ?? null,
          results: data,
        })
        .select('id')
        .single()
      savedSearchId = saved?.id ?? null
    } catch {
      // Fire-and-forget — don't block the response
    }

    return NextResponse.json({ ...data, savedSearchId, fccVerified: fccProvidersForUI.length > 0, webIntelligence: tavilyContextBlock.length > 100 })

  } catch (err: any) {
    console.error('[aria/research]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
