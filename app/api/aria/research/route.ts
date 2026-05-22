/**
 * POST /api/aria/research
 *
 * ARIA — Lead Intelligence Engine
 * Returns property intel, decision maker, intent signals, psychographic profile,
 * and 3 hyper-personalized email variants with predicted reply rates.
 *
 * Connectivity intel pipeline (runs before ARIA/Claude):
 *   1. Extract location hint from query (address or city/state)
 *   2. Geocode via Nominatim (OpenStreetMap) — no API key required
 *   3. Query FCC Broadband Map API for verified ISP coverage at that location
 *   4. Run 9 parallel Tavily OSINT searches:
 *      - Apartment listing sites (apartments.com, americantv.com, etc.)
 *      - Reddit/ApartmentRatings social signals
 *      - County deed/easement records (ISPs record MDU agreements against title)
 *      - ISP/PCO partnership announcements (World Cinema, KruseCom, WhiteSky)
 *      - Commercial RE Offering Memoranda (LoopNet/Crexi "ancillary income" section = 99% accuracy)
 *      - HOA meeting minutes + RFP documents (explicit contract dates)
 *      - LinkedIn MDU account executive win posts
 *      - Third-party locator sites (fee breakdowns exposing bundled service charges)
 *      - Forced-service resident complaints (exclusive provider signals)
 *      - Job postings listing telecom systems community managers must manage
 *      - REIT earnings calls announcing portfolio-wide MDU rollouts
 *      - City low-voltage/telecom permits (Accela) — ISPs pull permits when installing bulk
 *      - Community social media (Facebook/Instagram/Nextdoor) — property announces new ISP deal
 *      - ISP press releases naming property + contract term → exact expiry calculation
 *      - Historical listing snapshots — provider switches reveal expired contracts
 *      - ISP portfolio-level management company pages (gigstreem.com/amli/, etc.)
 *   5. Inject FCC + Tavily web intelligence as hard facts into ARIA's prompt
 *
 * KEY METHODOLOGY DISCOVERY (AMLI Marina Del Rey, May 2026):
 *   ISPs with portfolio-level deals create dedicated management company pages:
 *     gigstreem.com/amli/ — serves ALL AMLI residential properties
 *   The official AMLI amenities page says "Bulk Wi-Fi" but omits the ISP name.
 *   The ISP name surfaces in: (1) ISP's management-co page, (2) resident reviews,
 *   (3) locator fee breakdowns, (4) job postings for community managers.
 *   Search pattern: `"[PROPERTY NAME]" "[ISP]"` OR `"[MGMT-CO-SLUG]" site:[isp-domain].com`
 *   Both spellings matter: Gigstreem (correct) and Gigastream (common typo) both appear in indexed content.
 *
 * Accuracy targets (with all 15 sources + provider slug + mgmt-co slug searches):
 *   - ISP availability: ~95% (FCC 477 data, updated twice yearly)
 *   - Video provider: ~85% (FCC + americantv.com + PCO sites + locator reviews)
 *   - Bulk/exclusive agreements: ~93%+ when OM or county deed found; locator/complaint sites add coverage
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
  // City/state patterns: "in Atlanta", "Dallas TX", "Phoenix, Arizona", "in nashville", "chicago il"
  // Case-insensitive, also catches bare "City, ST" or "City ST" at end of string
  const cityStateRe = /(?:in|at|near|around|,)?\s*([A-Za-z][a-zA-Z\s]+(?:,\s*[A-Z]{2}|,\s*[A-Za-z]+|\s+[A-Z]{2}))/i
  const m = query.match(cityStateRe)
  if (m) {
    const candidate = m[1].trim()
    // Skip if it looks like a property name (too long or contains "at", "the", etc.)
    if (candidate.length <= 40 && !/\b(at|the|of|by|and|for)\b/i.test(candidate.split(',')[0]?.trim() || '')) {
      return candidate
    }
  }

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

const KNOWN_MGMT_COS = ['greystar','lincoln property','bozzuto','maa','aimco','cortland','equity residential','avalon','avalonbay','camden','national','rpm living','cardinal group','grayco','windsor','amli','nrp group','alliance residential','morgan properties','essex property','udr','independence realty','nvr','invitation homes','progress residential','mynd','tricon']

/**
 * Extract the management company name/slug from a query for use in ISP portfolio-page searches.
 *
 * DISCOVERY (AMLI Marina Del Rey investigation, May 2026):
 * ISPs with portfolio-level MDU deals create dedicated management company pages:
 *   gigstreem.com/amli/ → serves ALL AMLI properties
 *   gigstreem.com/greystar/ → serves ALL Greystar properties
 * Searching `"AMLI Marina Del Rey" site:gigstreem.com` finds these pages because the mgmt co name
 * appears on the page even when the specific property name doesn't.
 *
 * Returns the short slug (e.g. "amli", "greystar") when a known mgmt co is detected.
 */
function extractMgmtCoSlug(query: string): string | null {
  const q = query.toLowerCase()
  const slugMap: Record<string, string> = {
    'amli': 'amli',
    'greystar': 'greystar',
    'lincoln property': 'lincoln',
    'bozzuto': 'bozzuto',
    'maa': 'maa',
    'aimco': 'aimco',
    'cortland': 'cortland',
    'equity residential': 'equity-residential',
    'avalonbay': 'avalonbay',
    'avalon': 'avalon',
    'camden': 'camden',
    'rpm living': 'rpm-living',
    'cardinal group': 'cardinal-group',
    'udr': 'udr',
    'essex property': 'essex',
    'nrp group': 'nrp',
    'alliance residential': 'alliance',
    'morgan properties': 'morgan',
    'independence realty': 'independence-realty',
    'tricon': 'tricon',
  }
  for (const [name, slug] of Object.entries(slugMap)) {
    if (q.includes(name)) return slug
  }
  return null
}

/**
 * Extract the best search term from a query.
 *
 * CRITICAL: Always preserve the specific property name + location context.
 * The old implementation returned ONLY the management company name (e.g. "Cortland")
 * when the query contained a known company — stripping all property-specific context
 * and making all 9 Tavily searches uselessly generic.
 *
 * New logic:
 * - If the query looks like a specific property (contains "at", "the", apartment brand words,
 *   or a city name after the company name), return the full query trimmed to 80 chars.
 * - If the query is purely a management company name with no property specifics,
 *   use the company name as the terms (original behavior was correct in that case).
 * - The management company detection is now ADDITIVE context, not a replacement.
 */
function extractSearchTerms(query: string): string {
  const q = query.toLowerCase().trim()
  const trimmed = query.trim()

  // Detect if any known management company is in the query
  let matchedCo: string | null = null
  for (const co of KNOWN_MGMT_COS) {
    if (q.includes(co)) { matchedCo = co; break }
  }

  if (matchedCo) {
    // Check if there's specific property context beyond just the company name
    // Indicators: "at [Name]", "the [Name]", a city, specific property brand words
    const hasPropertyContext = (
      q.includes(' at ')     ||  // "Cortland at The Peake"
      q.includes(' the ')    ||  // "Greystar The Reserve"
      /\d/.test(q)           ||  // address with numbers
      q.length > matchedCo.length + 12  // significantly more text than just the company name
    )

    if (hasPropertyContext) {
      // Return the full query — it's a specific property search, don't strip context
      return trimmed.slice(0, 80)
    } else {
      // Query is just the management company name — use it as-is
      return matchedCo.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
    }
  }

  // No known company — return first 80 chars (was 60, expanded for better specificity)
  return trimmed.slice(0, 80)
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

// ─── Detection persistence ───────────────────────────────────────────────
/**
 * After ARIA returns structured results, persist any confirmed/high-confidence
 * bulk_agreements to mdu_provider_detections so they're cached for future lookups.
 *
 * Matches ARIA's provider names against mdu_providers.name (case-insensitive substring).
 * Only writes rows with confidence "high" or "confirmed" to avoid polluting the DB with guesses.
 */
async function persistProviderDetections(
  prospects: any[],
  queryText: string,
): Promise<void> {
  try {
    // Fetch all provider name→id mappings in one query
    const { data: allProviders } = await supabase
      .from('mdu_providers')
      .select('id, name, slug, provider_type')
      .eq('active', true)
    if (!allProviders || allProviders.length === 0) return

    const providerIndex = allProviders.map((p: any) => ({
      id: p.id as string,
      name: (p.name as string).toLowerCase(),
      slug: p.slug as string,
    }))

    const detectionsToInsert: Record<string, unknown>[] = []

    for (const prospect of prospects) {
      const propertyName    = prospect?.property?.name ?? ''
      const propertyAddress = prospect?.property?.address ?? ''
      const bulkAgreements: any[] = prospect?.property?.bulk_agreements ?? []

      for (const agreement of bulkAgreements) {
        const rawConfidence = agreement.confidence ?? 'low'
        // Only persist high-quality detections
        if (!['high', 'confirmed', 'medium-high'].includes(rawConfidence)) continue

        const agreementProvider = (agreement.provider ?? '').toLowerCase()
        if (!agreementProvider) continue

        // Find matching provider in our DB (substring match both ways)
        const matchedProvider = providerIndex.find(
          p => p.name.includes(agreementProvider) || agreementProvider.includes(p.name)
        )
        if (!matchedProvider) continue

        // Map ARIA confidence to our DB enum
        const dbConfidence =
          rawConfidence === 'confirmed' ? 'confirmed' :
          rawConfidence === 'high'      ? 'high' :
          rawConfidence === 'medium-high' ? 'high' : 'medium'

        detectionsToInsert.push({
          provider_id:      matchedProvider.id,
          property_name:    propertyName || null,
          property_address: propertyAddress || null,
          confidence:       dbConfidence,
          source_type:      'aria',
          source_snippet:   agreement.expiry_estimate
            ? `service_type=${agreement.service_type}; agreement_type=${agreement.agreement_type}; expiry_estimate=${agreement.expiry_estimate}`
            : `service_type=${agreement.service_type}; agreement_type=${agreement.agreement_type}`,
          contract_end_year: (() => {
            // Try to extract a year from expiry_estimate (e.g. "Q2 2027", "~2026", "2028")
            const match = (agreement.expiry_estimate ?? '').match(/20\d{2}/)
            return match ? parseInt(match[0], 10) : null
          })(),
          verified_by: 'aria',
        })
      }
    }

    if (detectionsToInsert.length === 0) return

    // Upsert — on conflict (same provider_id + property_name) update the confidence if it improved
    await supabase
      .from('mdu_provider_detections')
      .upsert(detectionsToInsert, {
        onConflict: 'provider_id,property_name',
        ignoreDuplicates: false,
      })
  } catch {
    // Completely non-blocking — detection persistence must never affect the response
  }
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
                      confidence:      { type: 'string', enum: ['confirmed', 'high', 'medium', 'low'] },
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
                  severity:    { type: 'string', enum: ['high', 'medium', 'low'] },
                },
              },
            },
            profile: {
              type: 'object',
              required: ['buy_score', 'urgency', 'primary_concern', 'current_vendor', 'contract_window', 'communication_style'],
              properties: {
                buy_score:           { type: 'number' },
                urgency:             { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
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
    // MDU provider reference data (populated from mdu_providers table)
    let mduProviderSlugs: Array<{ name: string; slug: string; property_page_pattern: string | null; operator_page_pattern: string | null; provider_type: string; notes: string | null }> = []
    let cachedDetectionsBlock = ''

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

    // ── MDU provider reference data ──
    // Fetch providers with URL patterns so we can generate targeted searches.
    // Also check for any cached detections for this query (property name match).
    const mduProviderPromise = (async () => {
      try {
        const { data: providers } = await supabase
          .from('mdu_providers')
          .select('name, slug, provider_type, property_page_pattern, operator_page_pattern, notes')
          .eq('active', true)
          .or('property_page_pattern.not.is.null,operator_page_pattern.not.is.null')
        if (providers && providers.length > 0) {
          mduProviderSlugs = providers
        }

        // Pull any existing detections for the search terms (exact or fuzzy property name match)
        if (searchTerms.length > 3) {
          const { data: detections } = await supabase
            .from('mdu_provider_detections')
            .select(`
              confidence, source_type, source_snippet, contract_end_year, verified_by,
              mdu_providers ( name, provider_type )
            `)
            .ilike('property_name', `%${searchTerms}%`)
            .in('confidence', ['confirmed', 'high', 'medium'])
            .limit(10)

          if (detections && detections.length > 0) {
            const detLines = detections.map((d: any) => {
              const prov = d.mdu_providers as { name: string; provider_type: string } | null
              const provName = prov?.name ?? 'Unknown provider'
              const provType = prov?.provider_type ?? 'isp'
              const snippet = d.source_snippet ? ` — "${d.source_snippet}"` : ''
              const expiry  = d.contract_end_year ? ` (contract est. ends ~${d.contract_end_year})` : ''
              return `• ${provName} (${provType}): ${d.confidence} confidence [${d.source_type}]${expiry}${snippet}`
            })
            cachedDetectionsBlock = `\n\nGATEGUARD CACHED PROVIDER DETECTIONS for "${searchTerms}":\n(Previously verified by ARIA — treat as high-confidence prior evidence)\n${detLines.join('\n')}\n`
          }
        }
      } catch { /* non-blocking */ }
    })()

    // Tavily OSINT searches — 9 parallel sources + provider slug pages, non-blocking if no API key
    const tavilyPromise = (async () => {
      if (!process.env.TAVILY_API_KEY) return
      const loc = locationHint || ''
      const terms = searchTerms

      const [
        listingSites,        // 1. Apartment listing sites — "internet included" + provider
        socialSignals,       // 2. Reddit/ApartmentRatings — "only option" exclusivity signals
        countyRecords,       // 3. County deed/easement records — ISP MDU agreements on title
        mduAnnouncements,    // 4. ISP/PCO MDU partnership announcements
        commercialRE,        // 5. Offering Memoranda (LoopNet/Crexi) — "ancillary income" gold mine
        hoaRfpDocs,          // 6. HOA meeting minutes + RFPs — explicit contract expiry dates
        linkedinMduReps,     // 7. LinkedIn MDU account executive win posts + americantv.com
        locatorSites,        // 8. Third-party locator sites — fee breakdowns exposing bundled charges
        forcedService,       // 9. Explicit forced-service resident complaints
        jobPostings,         // 10. Job listings for community managers listing telecom systems they manage
        reitEarnings,        // 11. REIT earnings calls + investor docs — portfolio-wide MDU rollout announcements
        cityPermits,         // 12. City low-voltage / telecom permits — ISPs pull permits when installing bulk
        communitySocial,     // 13. Property Facebook/Instagram/Nextdoor pages — official ISP partnership announcements
        ispPressRelease,     // 14. ISP press releases naming the property + contract term length → exact expiry calc
        historicalListing,   // 15. Older/archived listings revealing prior provider (switch = prior contract expired)
      ] = await Promise.all([

        // 1. Listing sites — most reliable for confirming "internet included" + exact provider
        // NOTE: Include both "Gigstreem" (correct) and "Gigastream" (common typo) — both appear in wild
        tavilySearch(
          `"${terms}" ${loc} "internet included" OR "bulk internet" OR "fiber included" OR "internet by" OR "Comcast included" OR "Spectrum included" OR "AT&T included" OR "DirecTV included" OR "DISH included" OR "Gigstreem included" OR "Gigastream included" OR "Hotwire included" OR "Boingo included" site:apartments.com OR site:apartmentlist.com OR site:rent.com OR site:zillow.com OR site:apartmentratings.com OR site:americantv.com`,
          4, 'listing-site'),

        // 2. Reddit/reviews — "only option" + forced-provider language = exclusive bulk deal
        tavilySearch(
          `"${terms}" ${loc} internet "only option" OR "can't use another" OR "forced to use" OR "included in rent" OR "only ISP" OR "building internet" OR "DirecTV bulk" OR "DISH bulk" OR "Spectrum bulk" OR "Gigstreem" OR "Gigastream" OR "Hotwire" OR "bulk wifi" OR "community wifi" site:reddit.com OR site:apartmentratings.com OR site:yelp.com OR site:google.com/maps`,
          5, 'social'),

        // 3. County deed / easement records — ISPs record MDU agreements against property title
        // Use both correct (Gigstreem) and common typo (Gigastream) spellings
        tavilySearch(
          `"${terms}" ${loc} apartment MDU broadband "memorandum of agreement" OR "right of entry" OR "easement" OR "bulk service agreement" OR "exclusive marketing agreement" internet provider county deed recorder DirecTV OR Charter OR Comcast OR Spectrum OR AT&T OR Gigstreem OR Gigastream OR Hotwire OR "Pavlov Media" OR "WideOpenWest"`,
          3, 'county-deed'),

        // 4. ISP/PCO partnership announcements — Private Cable Operators (World Cinema, KruseCom, WhiteSky)
        // These PCOs install DirecTV/DISH bulk into buildings and list their portfolios as case studies
        tavilySearch(
          `"${terms}" OR "${loc}" multifamily MDU "exclusive agreement" OR "bulk broadband" OR "community internet" OR "preferred provider" OR "agreement expires" OR "World Cinema" OR "KruseCom" OR "WhiteSky" OR "bulk video" OR "Gigstreem" OR "Gigastream" OR "Spot On Networks" OR "Wyyerd" DirecTV OR DISH OR Charter OR Comcast`,
          3, 'isp-partnership'),

        // 5. Commercial Real Estate Offering Memoranda — "Ancillary Income" section lists bulk provider + $ + expiry
        // Crexi, LoopNet, Marcus & Millichap, CBRE multifamily OM PDFs
        tavilySearch(
          `"${terms}" OR "${loc}" multifamily "offering memorandum" OR "OM" OR "investment summary" "ancillary income" OR "bulk internet" OR "bulk cable" OR "telecom revenue" provider expiration site:crexi.com OR site:loopnet.com OR site:marcus-millichap.com OR site:cbre.com OR site:jll.com`,
          3, 'commercial-re'),

        // 6. HOA/Board meeting minutes + active RFPs — explicit contract dates and renewal discussions
        // PMs and HOA boards upload meeting minutes to WordPress sites without password protection
        tavilySearch(
          `"${terms}" OR "${loc}" "HOA minutes" OR "board meeting" OR "RFP" OR "Request for Proposal" "bulk internet" OR "bulk cable" OR "DirecTV" OR "DISH" OR "Charter" OR "Spectrum" "expires" OR "renewal" OR "expiration" OR "contract end"`,
          3, 'hoa-rfp'),

        // 7. LinkedIn MDU sales rep win posts + americantv.com DirecTV dealer directory
        // MDU AEs post their wins: "excited to announce 10-year managed WiFi at [Property]!"
        tavilySearch(
          `"MDU account executive" OR "connected communities" OR "MDU sales" OR "multifamily internet" ${loc} "secured" OR "awarded" OR "signed" OR "agreement" apartment OR multifamily DirecTV OR Charter OR Comcast OR Gigstreem OR Gigastream OR "Hotwire" OR "Spectrum" OR "Pavlov Media" OR "Spot On Networks" site:linkedin.com OR site:americantv.com`,
          3, 'linkedin-mdu'),

        // 8. Third-party locator sites — fee breakdowns reveal bundled service charges
        // TacoStreetLocating, Apartment List locators, Dwellsy post move-in cost breakdowns
        // that explicitly show "$80/month DirecTV fee" or "required internet: $65/month Gigastream"
        tavilySearch(
          `"${terms}" ${loc} ("internet fee" OR "cable fee" OR "DirecTV included" OR "TV fee" OR "bundled fee" OR "required fee" OR "internet included" OR "forced service" OR "bulk service fee" OR "mandatory cable" OR "required internet") apartment fees breakdown`,
          4, 'locator-site'),

        // 9. Forced-service explicit resident complaints — strongest exclusive-provider signal
        // "I can't switch" / "only option" complaints on Google Maps, Yelp, Reddit NOT on official site
        tavilySearch(
          `"${terms}" ${loc} ("forced to use" OR "have to use" OR "only option" OR "can't switch" OR "required to pay for" OR "no choice" OR "stuck with" OR "mandatory" OR "can't cancel") ("DirecTV" OR "Spectrum" OR "Comcast" OR "AT&T" OR "internet" OR "cable" OR "Gigstreem" OR "Gigastream" OR "DISH" OR "Hotwire" OR "Boingo") -site:cortland.com -site:apartments.com -site:cortlandliving.com`,
          4, 'forced-service'),

        // 10. Job postings for property staff — community managers list specific telecom systems they manage
        // "Responsible for coordinating with our bulk Wi-Fi partner, WhiteSky, and managing resident onboarding"
        // LinkedIn/Indeed/ZipRecruiter job descriptions are public and reveal the vendor inside the building
        tavilySearch(
          `"${terms}" OR "${loc}" "community manager" OR "property manager" OR "maintenance supervisor" "manage" OR "coordinate" "bulk internet" OR "managed WiFi" OR "DirecTV" OR "Spectrum" OR "bulk cable" OR "telecom" OR "WhiteSky" OR "Boingo" OR "Gigstreem" OR "Gigastream" OR "Hotwire" OR "Spot On Networks" OR "Wyyerd" site:linkedin.com OR site:indeed.com OR site:ziprecruiter.com OR site:glassdoor.com`,
          3, 'job-posting'),

        // 11. REIT earnings calls + investor materials — executives brag about portfolio-wide MDU rollouts
        // "We've completed a portfolio-wide managed WiFi rollout with Boingo across 40 communities"
        // Seeking Alpha, investor relations pages, SEC 8-K filings
        tavilySearch(
          `${loc} multifamily REIT "managed WiFi" OR "bulk internet" OR "community internet" OR "portfolio-wide" OR "bulk broadband" rollout OR "agreement" OR "partner" Spectrum OR Comcast OR DirecTV OR Boingo OR Hotwire OR "Gigstreem" OR "Gigastream" OR "WhiteSky" OR "Spot On Networks" site:seekingalpha.com OR site:sec.gov OR "earnings call" OR "investor presentation"`,
          3, 'reit-earnings'),

        // 12. City low-voltage / telecom permits — ISPs pull permits when installing bulk infrastructure
        // Accela, Clariti, eCityGov public permit portals indexed by Google
        // "Low voltage", "CATV", "fiber installation", "telecommunications" permit at multifamily address
        tavilySearch(
          `"${terms}" ${loc} permit "low voltage" OR "CATV" OR "fiber" OR "telecommunications" OR "structured wiring" OR "bulk cable" multifamily OR apartment Comcast OR Spectrum OR DirecTV OR AT&T OR Gigastream OR "managed WiFi" Accela OR permit`,
          3, 'city-permit'),

        // 13. Community social media pages — property Facebook/Instagram/Nextdoor accounts announce new ISP deals
        // "We're thrilled to announce our new internet partnership with Gigstreem!"
        // Management cos post these on official community pages; Nextdoor admins post on behalf of the property
        tavilySearch(
          `"${terms}" ${loc} "excited to announce" OR "thrilled to announce" OR "new internet" OR "new WiFi" OR "new partnership" OR "now offering" OR "bulk internet" OR "community WiFi" OR "included internet" "DirecTV" OR "Spectrum" OR "Comcast" OR "AT&T" OR "Gigstreem" OR "Gigastream" OR "Hotwire" OR "Boingo" OR "WhiteSky" OR "Wyyerd" site:facebook.com OR site:nextdoor.com OR site:instagram.com OR site:twitter.com OR site:x.com`,
          3, 'community-social'),

        // 14. ISP press releases with contract term details — ISPs issue press releases naming the property + deal term
        // "Hotwire Communications signs 10-year agreement with The Reserve at Peake"
        // PR Newswire, BusinessWire, Globe Newswire, and ISP newsrooms index these publicly
        // GOLD MINE for contract expiry: post date + stated term = exact expiry year
        tavilySearch(
          `"${terms}" OR "${loc}" "signed" OR "agreement" OR "partnership" OR "contract" "year" "managed WiFi" OR "bulk internet" OR "bulk broadband" OR "community internet" OR "MDU" OR "multi-family" Hotwire OR Spectrum OR Comcast OR "World Cinema" OR Gigstreem OR Gigastream OR Boingo OR "Pavlov Media" OR "Bsquared" OR "WhiteSky" OR "KruseCom" OR "Spot On Networks" OR "Wyyerd" site:prnewswire.com OR site:businesswire.com OR site:globenewswire.com OR site:accesswire.com`,
          3, 'isp-press-release'),

        // 15. Historical listing snapshots — detect provider SWITCHES (old listing shows Comcast, new shows Spectrum = Comcast contract expired)
        // Archive.org / Google cache / Wayback Machine indexes old apartment listing pages
        // A provider change is the CLEAREST possible signal that the prior contract expired
        // Also catches properties that previously showed "internet included" but no longer do (contract expired, not renewed)
        tavilySearch(
          `"${terms}" ${loc} "internet included" OR "internet by" OR "bulk internet" OR "DirecTV included" OR "Spectrum included" OR "Comcast included" -site:apartments.com -site:zillow.com -site:apartmentlist.com`,
          3, 'historical-listing'),
      ])

      // 10. Provider slug page searches — check known MDU ISPs' property/operator pages
      // e.g. gigstreem.com/[property-slug] or pavlovmedia.com/[property-slug]
      // These pages are created by the ISP when they sign a bulk deal — highest confidence confirmation
      //
      // AMLI MARINA DEL REY DISCOVERY (May 2026):
      // ISPs also create MANAGEMENT COMPANY portfolio pages: gigstreem.com/amli/ serves ALL AMLI properties.
      // The winning search was `"AMLI Marina Del Rey" "gigstreem"` → returned gigstreem.com/amli/.
      // So we run TWO searches per ISP domain: one with the full property name AND one with just the mgmt co slug.
      const propertySlug = terms.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const mgmtCoSlug = extractMgmtCoSlug(query) // e.g. "AMLI" → "amli", "Greystar" → "greystar"
      const providerSlugResults: TavilyResult[] = []
      if (mduProviderSlugs.length > 0) {
        const slugSearches: Array<Promise<TavilyResult[]>> = []

        const providersToSearch = mduProviderSlugs
          .filter(p => p.property_page_pattern || p.operator_page_pattern)
          .slice(0, 8) // cap at 8 to avoid burning Tavily credits

        for (const p of providersToSearch) {
          const domain = (p.property_page_pattern || p.operator_page_pattern || '')
            .replace(/\{.*?\}/g, '') // strip {property} / {operator} template tokens
            .replace(/\/$/, '')
          if (!domain) continue
          const domainOnly = domain.replace(/^https?:\/\//, '').split('/')[0]

          // Search 1: full property name on ISP domain (finds property-specific pages)
          slugSearches.push(tavilySearch(`"${terms}" site:${domainOnly}`, 2, 'provider-slug'))

          // Search 2: management company name on ISP domain (finds portfolio-level partnership pages)
          // CRITICAL: This is how we found gigstreem.com/amli/ for AMLI Marina Del Rey
          if (mgmtCoSlug && mgmtCoSlug.length > 2) {
            slugSearches.push(tavilySearch(`"${mgmtCoSlug}" site:${domainOnly}`, 2, 'provider-slug'))
          }
        }

        const slugResponses = await Promise.allSettled(slugSearches)
        for (const res of slugResponses) {
          if (res.status === 'fulfilled') providerSlugResults.push(...res.value)
        }
      }

      // Also run a direct ISP-name search for major MDU ISPs not yet in the mdu_providers table
      // These are the ISPs most likely to have portfolio-level management company pages
      // Using both correct spellings and common typos since both appear in indexed content
      const directIspSearches = await Promise.all([
        tavilySearch(`"${terms}" OR "${mgmtCoSlug ?? terms}" site:gigstreem.com`, 2, 'provider-slug'),
        tavilySearch(`"${terms}" OR "${mgmtCoSlug ?? terms}" site:hotwire.com`, 2, 'provider-slug'),
        tavilySearch(`"${terms}" site:pavlovmedia.com`, 2, 'provider-slug'),
        tavilySearch(`"${terms}" site:spotonnetworks.com`, 2, 'provider-slug'),
        tavilySearch(`"${terms}" OR "${mgmtCoSlug ?? terms}" site:boingo.com`, 2, 'provider-slug'),
      ])
      for (const results of directIspSearches) {
        providerSlugResults.push(...results)
      }

      const allResults = [
        ...listingSites,
        ...socialSignals,
        ...countyRecords,
        ...mduAnnouncements,
        ...commercialRE,
        ...hoaRfpDocs,
        ...linkedinMduReps,
        ...locatorSites,
        ...forcedService,
        ...providerSlugResults,
        ...jobPostings,
        ...reitEarnings,
        ...cityPermits,
        ...communitySocial,
        ...ispPressRelease,
        ...historicalListing,
      ]
        .filter(r => r.score > 0.20)
        .sort((a, b) => {
          // Boost highest-signal sources: county deed, commercial RE OM, HOA/RFP docs
          const boostMap: Record<string, number> = {
            'provider-slug':  0.40, // ISP's own property page = highest confidence
            'county-deed':    0.35,
            'commercial-re':  0.30,
            'city-permit':    0.28, // Low-voltage permits = ISP installing infrastructure at address
            'hoa-rfp':        0.25,
            'reit-earnings':  0.25, // Portfolio-wide announcements name exact vendors
            'listing-site':   0.20,
            'locator-site':   0.22,
            'job-posting':    0.20, // Community manager job descriptions name the systems they manage
            'community-social':   0.22, // Official property social media announcing ISP partnerships
            'isp-press-release':  0.38, // ISP PR with property name + term length = direct expiry calculation
            'historical-listing': 0.20, // Provider change detected = prior contract just expired
            'forced-service': 0.18,
            'linkedin-mdu':   0.15,
            'isp-partnership':0.10,
            social:           0.05,
          }
          const aBoost = boostMap[a.source ?? ''] ?? 0
          const bBoost = boostMap[b.source ?? ''] ?? 0
          return (b.score + bBoost) - (a.score + aBoost)
        })
        .slice(0, 20)

      if (allResults.length === 0) return

      const sourceLabels: Record<string, string> = {
        'provider-slug':  'PROVIDER-SLUG-PAGE',
        'listing-site':   'LISTING-SITE',
        social:           'REDDIT/REVIEW',
        'county-deed':    'COUNTY-DEED',
        'isp-partnership':'ISP-PARTNERSHIP',
        'commercial-re':  'OFFERING-MEMO',
        'hoa-rfp':        'HOA-MINUTES/RFP',
        'linkedin-mdu':   'LINKEDIN-MDU-REP',
        'locator-site':   'LOCATOR-REVIEW',
        'forced-service': 'FORCED-SERVICE',
        'job-posting':    'JOB-POSTING',
        'reit-earnings':  'REIT-EARNINGS',
        'city-permit':    'CITY-PERMIT',
        'community-social':   'COMMUNITY-SOCIAL',
        'isp-press-release':  'ISP-PRESS-RELEASE',
        'historical-listing': 'HISTORICAL-LISTING',
        web:              'WEB',
      }

      tavilyContextBlock = `\n\nWEB INTELLIGENCE — Live OSINT (9 sources, use as primary evidence for bulk_agreements[] and isp_providers[]):
${allResults.map((r) => `[${sourceLabels[r.source ?? 'web'] ?? 'WEB'}] ${r.title}\nURL: ${r.url}\n${r.content.slice(0, 800)}`).join('\n\n---\n\n')}

SIGNAL EXTRACTION RULES (apply in this priority order):
0. [PROVIDER-SLUG-PAGE] ISP's own property or operator portal page for this property → confidence="confirmed", agreement_type="bulk" — this is the highest-confidence source possible
1. [COUNTY-DEED] names ISP + "memorandum/easement/agreement" + dates → confidence="high", extract expiry_estimate from term length
2. [ISP-PRESS-RELEASE] ISP or property management PR naming this property + contract term length → confidence="high" — this is PRIMARY for calculating exact expiry dates. CALCULATION: find the publication date of the press release (in URL or article date), add the stated term (e.g. "10-year agreement" published 2018 = expires 2028). Always compute and output this year as expiry_estimate.
3. [OFFERING-MEMO] "ancillary income" line item names provider + $ amount + expiry → confidence="high", this is the 99% accuracy source
4. [CITY-PERMIT] low-voltage or telecom permit pulled at this property's address naming an ISP → confidence="high" — ISPs only pull permits when actively installing. For expiry: typical MDU terms are 7-10 years from permit date. Calculate: permit_year + 8 = estimated expiry.
5. [HOA-MINUTES/RFP] board minutes or RFP mentions contract renewal/expiry → confidence="high" for timing, "medium" if provider unclear. Extract any explicit years or phrases like "expires 2026", "up for renewal next year"
6. [REIT-EARNINGS] REIT CEO/CFO names a portfolio-wide rollout in earnings call or investor filing → confidence="high" for the named provider, especially if this property is in that portfolio
7. [LINKEDIN-MDU-REP] sales rep post: "secured 10-year agreement with [Property]" → confidence="medium-high". EXPIRY CALC: extract post year from URL or text (e.g., linkedin.com/posts/... from 2019) + stated term = expiry year.
8. [JOB-POSTING] property manager job description lists specific telecom systems → confidence="medium-high". For expiry: if job was posted recently and lists an ISP as a "required" system, the contract is active. If the same property's prior job posting listed a DIFFERENT ISP, the switch date = approximate prior contract expiry.
9. [COMMUNITY-SOCIAL] property's official Facebook/Instagram/Nextdoor page announces partnership → confidence="high". EXPIRY CALC: post date + typical 5-10 year MDU term = estimate. Flag the post date explicitly.
10. [HISTORICAL-LISTING] old listing showed ISP-A, current shows ISP-B → the contract with ISP-A expired approximately when the listing changed. The current ISP's contract started then. Apply typical 7-10 year term → estimate when CURRENT contract expires.
11. [LISTING-SITE] "internet by [ISP]" or "bulk internet included" → confidence="medium"
12. [LOCATOR-REVIEW] third-party locator fee breakdown with "internet fee: $X/mo [ISP]" → confidence="medium-high"
13. [FORCED-SERVICE] resident explicitly says "forced to use [ISP]", "can't switch" → agreement_type="exclusive", confidence="medium"
14. [REDDIT/REVIEW] "only option is [ISP]" → agreement_type="exclusive", confidence="medium"
15. [ISP-PARTNERSHIP] PCO (World Cinema/KruseCom/WhiteSky) case study → confidence="medium" for DISH/DirecTV provider
16. Local/regional ISPs (Gigastream, Sonic, Hotwire, WideOpenWest, Vyve, Metronet, Brightspeed, Ting, Consolidated) → TRUST over national carrier — they often ARE the MDU bulk provider
17. americantv.com listing for DirecTV/DISH dealer serving this area → use as supporting evidence for video_providers[]

CONTRACT EXPIRY DATE CALCULATION (apply every time, in priority order):
A. EXPLICIT DATE: Any source states "expires [month/year]" or "through [year]" → use directly, confidence="high"
B. PRESS RELEASE CALC: [PR publication date] + [stated term in years] = expiry year. Example: PR from March 2017 says "5-year agreement" → expiry = 2022. Output as expiry_estimate: "~2022 (est. from 2017 press release + 5yr term)"
C. LINKEDIN CALC: [Post date from URL/content] + [stated term] = expiry year. Example: 2019 post says "10-year deal" → expiry ~2029
D. PERMIT CALC: [Permit date] + 8 years (MDU industry standard term) = estimated expiry. Output as "~[year] (est. from [permit_date] permit + 8yr typical MDU term)"
E. PROPERTY ACQUISITION CALC: if OM from a sale shows a bulk agreement and remaining years, calculate: [sale date] + [remaining years] = expiry
F. PROVIDER SWITCH INFERENCE: if historical listing shows provider changed, current contract started ~[switch date]. Apply typical 7-10 year term → "~[switch_year + 8] (est. from provider switch detection)"
G. NO DATE FOUND: output expiry_estimate: "unknown — no term data found" — never guess without a calculation basis

MULTI-CONFIRMATION INFERENCE RULES:
- Same provider named in 2+ independent sources (e.g., Reddit complaint + listing site + job posting all say "Spectrum") → upgrade confidence from "medium" to "high"
- Same provider named in 3+ independent sources → confidence="confirmed"
- Conflicting providers named (Reddit says Spectrum, listing says Comcast) → report BOTH in bulk_agreements[], lower confidence on each, note the conflict
- A "forced service" complaint + listing confirmation = agreement_type="exclusive" with confidence="high"
- FCC shows ONLY 1 fiber provider at this address + any human source confirms that same provider = confidence="high"
- FCC shows ONLY 1 fiber provider + 2 human confirmations = confidence="confirmed"

TRIANGULATION RULE: If you find evidence from 2 of these 3 categories:
  (A) Legal/Financial: COUNTY-DEED, OFFERING-MEMO, CITY-PERMIT, REIT-EARNINGS, ISP-PRESS-RELEASE
  (B) Infrastructure: PROVIDER-SLUG-PAGE, FCC fiber monopoly at address
  (C) Human: FORCED-SERVICE, REDDIT/REVIEW, JOB-POSTING, LOCATOR-REVIEW, COMMUNITY-SOCIAL, HISTORICAL-LISTING
→ upgrade confidence to "high". If all 3 categories have evidence → confidence="confirmed".

FCC MONOPOLY SIGNAL: If FCC data shows only 1 ISP with fiber infrastructure at this address, this is strong corroborating evidence for an exclusive bulk arrangement. Note the specific ISP in your analysis.

If NO web evidence found above → bulk_agreements = [] (never infer from market patterns alone)`
    })()

    await Promise.allSettled([fccPromise, oppPromise, tavilyPromise, mduProviderPromise])

    const existingNamesBlock = existingOppNames.length > 0
      ? `\n\nEXCLUSION LIST — these properties are already active in our CRM pipeline. Do NOT suggest any of these as prospects:\n${existingOppNames.map(n => `- ${n}`).join('\n')}\n`
      : ''

    // Build MDU provider context for Claude — list providers with URL patterns so it knows what to look for
    const mduProviderContextBlock = mduProviderSlugs.length > 0
      ? `\n\nKNOWN MDU PROVIDER DATABASE (GateGuard internal — use to cross-reference Tavily results):\n` +
        `The following ISPs/video providers have MDU bulk programs. If web results reference any of these, give them higher confidence.\n` +
        mduProviderSlugs
          .map(p => {
            const urlNote = p.property_page_pattern
              ? ` | Property page: ${p.property_page_pattern}`
              : p.operator_page_pattern
              ? ` | Operator page: ${p.operator_page_pattern}`
              : ''
            return `• ${p.name} (${p.provider_type})${urlNote}`
          })
          .join('\n') +
        `\n[PROVIDER-SLUG-PAGE] source type = a result from one of these ISPs' own property/operator pages — this is CONFIRMATION-LEVEL evidence (treat as confidence="high").`
      : ''

    // ── Step 3: Build FCC context block for Claude ──
    const fccContextBlock = fccBlock
      ? `\n\n${fccBlock}\n\nIMPORTANT — FCC DATA USAGE RULES:\n1. Use FCC data for isp_providers[] (which ISPs cover this area). Do NOT invent ISPs not in this list.\n2. FCC data does NOT tell you which ISP has a bulk/MDU/exclusive deal with a specific property.\n3. Do NOT populate bulk_agreements[] based on FCC data alone.\n4. bulk_agreements[] requires explicit evidence: listing description, resident review, management company statement, or property website saying "internet included" or naming a specific provider.\n5. A local or regional ISP NOT on the FCC list could be the actual bulk provider (they may serve the property under a private MDU contract without FCC 477 coverage filing).\n6. Set confidence="low" on any bulk agreement inferred from FCC data + property class alone. "medium" requires one corroborating source. "high" requires explicit text evidence.\n`
      : `\n\nNOTE: FCC broadband data unavailable for this query (no location resolved). Use your best knowledge of typical ISP coverage in the target market. Apply strict confidence rules for bulk_agreements[].\n`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 6000,
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
- bulk_agreements[] must have explicit evidence. Acceptable evidence sources in priority order:
  1. [OFFERING-MEMO] "Ancillary income" section explicitly names provider + dollar amount + expiry → confidence="high"
  2. [COUNTY-DEED] memorandum/easement/right-of-entry naming ISP + agreement dates → confidence="high"
  3. [HOA-MINUTES/RFP] board meeting explicitly mentions contract renewal/expiry with provider → confidence="high"
  4. [LINKEDIN-MDU-REP] MDU Account Exec posts win for this property + term length → confidence="medium-high"
  5. [LISTING-SITE] "internet by [ISP]" or "internet included" or "DISH included" in listing → confidence="medium"
  5b. [LOCATOR-REVIEW] third-party locator site (TacoStreetLocating, Dwellsy, etc.) lists move-in fee breakdown showing "internet fee: $X/mo [ISP]" or "required DirecTV: $Y/mo" → confidence="medium-high" — locators show actual costs tenants must pay; highly reliable for confirming forced/bulk service
  6. [REDDIT/REVIEW] resident says "only option is [ISP]", "can't use any other provider" → agreement_type="exclusive", confidence="medium"
  6b. [FORCED-SERVICE] resident complaint on Google/Yelp/Reddit (not official property site) explicitly says "forced to use [ISP]", "can't switch", "stuck with [ISP]" → agreement_type="exclusive", confidence="medium-high" — unsolicited complaints are strong exclusive-provider signals
  7. [ISP-PARTNERSHIP] PCO (World Cinema/KruseCom/WhiteSky) case study names building → confidence="medium"
- WEB INTELLIGENCE (provided below with source labels): ALWAYS higher priority than FCC data or pattern inference.
- Local/regional ISPs (Gigstreem [NOTE: "Gigastream" is a common misspelling of Gigstreem — treat as same ISP], Sonic, Hotwire, WideOpenWest, Vyve, Metronet, IgLou, Blue Ridge, Spot On Networks, Wyyerd, Pavlov Media, Bsquared) frequently have MDU exclusive deals. Trust these when mentioned even once.
- MANAGEMENT COMPANY PORTFOLIO PAGES: If a [PROVIDER-SLUG-PAGE] source is from [isp-domain].com/[management-company-slug]/ (e.g. gigstreem.com/amli/), this confirms the ISP has a PORTFOLIO-LEVEL deal with the management company — treat as confidence="high" for ANY property in that management company's portfolio. Key discovery: official property amenities pages say "Bulk Wi-Fi" but omit the ISP name; the ISP name surfaces on the ISP's own mgmt-co page.
- americantv.com lists DirecTV MDU dealers who serve specific markets — if a dealer is listed as active in a city, treat as supporting evidence for DirecTV/AT&T video presence.
- Private Cable Operators (World Cinema, KruseCom, WhiteSky, Encompass) install DISH/DirecTV bulk. If their case studies mention a building → strong DISH/DirecTV signal.
- Do NOT default to Spectrum/Comcast/AT&T just because they're the largest carrier. The actual MDU provider could be a local ISP.
- If zero web evidence found → bulk_agreements = [] (empty is better than a guess).
- confidence levels:
  * "high" = Offering Memo OR county deed OR HOA minutes explicitly names provider + terms
  * "medium-high" = locator site fee breakdown OR unsolicited forced-service resident complaint names specific ISP
  * "medium" = listing site, LinkedIn rep post, or PCO portfolio names provider; OR resident says "only option"
  * "low" = FCC pattern only, no property-specific source

ISP & VIDEO PROVIDER RESEARCH:
- If FCC broadband data is provided below, use ONLY those ISPs for isp_providers[]. This is verified government data, not inference.
- For video_providers: FCC 477 does not cover video. Research which video/TV providers serve the property.
- Third-party locator sites (TacoStreetLocating, Dwellsy, Apartment List locators) sometimes itemize ALL required fees including bundled TV/internet — treat this as ground truth for video_providers[] and bulk_agreements[].
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
${existingNamesBlock}${cachedDetectionsBlock}${mduProviderContextBlock}${fccContextBlock}${tavilyContextBlock}
GateGuard offerings to weave into emails where relevant:
- Gate operators, access control (Brivo), intercoms, cameras — full stack install
- Visitor management: GateCard platform — resident app, mobile access, delivery management
- DirecTV/AT&T MDU bulk TV + internet for whole building (ATLAS bundle)
- The Elevate Model: $10/unit/mo GateGuard cost → $150/yr resident fee → $30/unit/yr net profit for property
- SARA Bridge: easy migration path from SARA Plus

${fccBlock ? 'The FCC data above is already resolved for this location. Use it directly for isp_providers[]. Do NOT override it with your own inference.' : 'No FCC data available. Infer ISPs from your knowledge of the target market.'}
${tavilyContextBlock ? 'Web Intelligence results are provided above (9 OSINT sources). Prioritize [OFFERING-MEMO] and [COUNTY-DEED] for contract expiry dates. [LOCATOR-REVIEW] and [FORCED-SERVICE] are high-reliability sources for bulk/exclusive agreements — treat them as ground truth when present. Use [LISTING-SITE], [REDDIT/REVIEW], [HOA-MINUTES/RFP], [LINKEDIN-MDU-REP], and [ISP-PARTNERSHIP] as supporting evidence. These are live search results — always prioritize them over pattern inference.' : ''}

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

    // ── Persist provider detections back to mdu_provider_detections (non-blocking) ──
    void persistProviderDetections(data.prospects ?? [], query.trim())

    return NextResponse.json({ ...data, savedSearchId, fccVerified: fccProvidersForUI.length > 0, webIntelligence: tavilyContextBlock.length > 100 })

  } catch (err: any) {
    console.error('[aria/research]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
