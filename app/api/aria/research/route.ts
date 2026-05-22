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

async function tavilySearch(query: string, maxResults = 4, source = 'web', days?: number): Promise<TavilyResult[]> {
  if (!process.env.TAVILY_API_KEY) return []
  try {
    const body: Record<string, unknown> = {
      query, search_depth: 'basic', max_results: maxResults,
      include_answer: false, include_raw_content: false, include_images: false,
    }
    if (days) body.days = days // Tavily recency filter — omit to get all-time results
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.TAVILY_API_KEY}` },
      body: JSON.stringify(body),
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
 * Derive a searchable domain for an MDU provider.
 *
 * Priority order:
 *   1. Extract from property_page_pattern / operator_page_pattern URL template
 *      (e.g. "https://gigstreem.com/{property}" → "gigstreem.com")
 *   2. Fallback: slug.com — works for simple slugs without hyphens (gigstreem, wyyerd, boingo, hotwire)
 *   3. Returns null when neither works (hyphenated slugs like "spot-on-networks" have no reliable .com guess)
 *
 * This is what enables the "same loci as Gigstreem" approach for every provider:
 *   `"${property}" site:${deriveDomain(p)}`  → property-specific pages
 *   `"${mgmtCoSlug}" site:${deriveDomain(p)}` → portfolio-level management company pages
 */
function deriveDomain(p: { slug: string; property_page_pattern: string | null; operator_page_pattern: string | null }): string | null {
  const urlTemplate = p.property_page_pattern || p.operator_page_pattern
  if (urlTemplate) {
    return urlTemplate
      .replace(/\{.*?\}/g, '')
      .replace(/\/$/, '')
      .replace(/^https?:\/\//, '')
      .split('/')[0]
  }
  // Slug-to-domain fallback: only safe for single-word slugs (no hyphens = no ambiguity)
  if (!p.slug.includes('-') && p.slug.length > 3 && p.slug.length < 30) {
    return `${p.slug}.com`
  }
  return null
}

// ─── Contract date discovery helpers ─────────────────────────────────────────

interface WaybackResult { url: string; firstSeen: string; estimatedExpiry: string }

/**
 * Wayback Machine CDX API — check when a URL was first successfully crawled.
 *
 * ISPs create management-company portfolio pages (e.g. gigstreem.com/amli/) when they sign
 * a portfolio deal. The first Wayback crawl date ≈ deal announcement date.
 *
 * Calculation: first_crawl_year + 8 years (MDU industry standard term) = estimated expiry.
 * Free public API — no key required.
 */
async function checkWaybackTimestamp(url: string): Promise<WaybackResult | null> {
  try {
    // Normalize URL: ensure trailing slash for directory pages
    const normalized = url.replace(/\/$/, '') + '/'
    const cdxUrl = `http://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(normalized)}&output=json&limit=1&fl=timestamp&from=20100101&filter=statuscode:200`
    const res = await fetch(cdxUrl, {
      signal: AbortSignal.timeout(6000),
      headers: { 'User-Agent': 'GateGuard-ARIA/1.0 (rfeldman@gateguard.co)' },
    })
    if (!res.ok) return null
    const data = await res.json()
    // Format: [["timestamp"], ["20180315123045"]] — first row = header, second = result
    if (!Array.isArray(data) || data.length < 2) return null
    const ts = data[1]?.[0]
    if (!ts || ts.length < 8) return null
    const year  = parseInt(ts.slice(0, 4), 10)
    const month = ts.slice(4, 6)
    const day   = ts.slice(6, 8)
    const expiryYear = year + 8  // 8yr = MDU industry standard term midpoint
    return {
      url: normalized,
      firstSeen: `${year}-${month}-${day}`,
      estimatedExpiry: `~${expiryYear} (est. from Wayback first-crawl ${year}-${month}-${day} + 8yr typical MDU term)`,
    }
  } catch {
    return null
  }
}

/**
 * SEC EDGAR Full-Text Search — find 10-K/10-Q REIT filings disclosing bulk telecom agreements.
 *
 * Public REITs and management companies must disclose "material" contracts in SEC filings.
 * A 10-year $5M bulk internet deal is material → appears in 10-K "Commitments and Contingencies"
 * or "Other Income" sections. Includes specific ISP name, term, and sometimes dollar value.
 *
 * EDGAR EFTS (Electronic Full-Text Search) — free, no API key required.
 * Endpoint: https://efts.sec.gov/LATEST/search-index?q=...&forms=10-K,10-Q
 */
async function searchEdgarBulkAgreements(terms: string, mgmtCo: string): Promise<string> {
  try {
    const target = mgmtCo.length > 2 ? `"${mgmtCo}"` : `"${terms.slice(0, 40).replace(/"/g, '')}"`
    const telecomPhrases = `("bulk cable agreement" OR "bulk internet agreement" OR "telecommunications agreement" OR "bulk broadband" OR "managed wifi" OR "bulk cable" OR "exclusive internet" OR "bulk telecommunications" OR "bulk video agreement" OR "master telecommunications agreement" OR "MDU agreement" OR "right of entry agreement")`
    const ispNames = `(Charter OR Spectrum OR Comcast OR Xfinity OR Cox OR "AT&T" OR DirecTV OR Hotwire OR Gigstreem OR "Pavlov Media" OR "Spot On Networks" OR Wyyerd OR Boingo OR WideOpenWest OR Metronet OR Vyve OR Brightspeed OR Ting OR Consolidated OR Lumen)`
    // 10-K/10-Q = annual/quarterly disclosures (Commitments + Other Income sections)
    // 8-K = material event announcement (companies file when signing a large MDU contract)
    const forms = '10-K,10-Q,8-K'
    const baseParams = `&forms=${forms}&dateRange=custom&startdt=2014-01-01`
    // Query 1: management company + telecom phrases
    const q1 = `${target} AND ${telecomPhrases}`
    // Query 2: management company + specific ISP names + telecom phrases
    const q2 = `${target} AND ${ispNames} AND ${telecomPhrases}`
    const fetchOpts = {
      signal: AbortSignal.timeout(8000),
      headers: { 'Accept': 'application/json', 'User-Agent': 'GateGuard-ARIA/1.0 (rfeldman@gateguard.co)' },
    }
    const [res1, res2] = await Promise.allSettled([
      fetch(`https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(q1)}${baseParams}`, fetchOpts),
      fetch(`https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(q2)}${baseParams}`, fetchOpts),
    ])
    const seenIds = new Set<string>()
    const lines: string[] = []
    for (const result of [res1, res2]) {
      if (result.status !== 'fulfilled' || !result.value.ok) continue
      const data = await result.value.json()
      const hits: any[] = data?.hits?.hits ?? []
      for (const h of hits.slice(0, 5)) {
        const id = h._id ?? ''
        if (seenIds.has(id)) continue
        seenIds.add(id)
        const entity   = (h._source?.entity_name ?? 'Unknown entity').replace(/\s+/g, ' ').trim()
        const fileDate = h._source?.file_date    ?? 'unknown date'
        const formType = h._source?.form_type    ?? 'SEC filing'
        const cik      = h._source?.entity_id    ?? ''
        const filingUrl = cik
          ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=${formType}&dateb=&owner=include&count=10`
          : ''
        const typeNote = formType === '8-K'
          ? ' [8-K: material agreement event — check EX-10 exhibit for actual contract]'
          : ' [annual/quarterly — check Commitments & Contingencies section]'
        lines.push(`[SEC-EDGAR/${formType}] ${entity} | filed ${fileDate}${typeNote}${filingUrl ? ` | ${filingUrl}` : ''}`)
      }
    }
    if (lines.length === 0) return ''
    return `\n\nSEC EDGAR — REIT/PUBLIC FILINGS (10-K, 10-Q, 8-K) bulk telecom disclosures for "${mgmtCo || terms}":\n${lines.join('\n')}\nNOTE: entity_name IS the REIT/public company — this tells you who owns the portfolio.\nFor 8-K hits: the EX-10 exhibit attached to the filing is often the actual executed contract with term + expiry.\nFor 10-K/10-Q hits: search the filing text for the ISP name + "term" or "expiration" in the Commitments section.\nAlso: look up the REIT entity's investor relations page to find their asset manager / management team names.\n`
  } catch {
    return ''
  }
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

// ─── Contract findings persistence ──────────────────────────────────────────

/**
 * Persist discovered contract findings to aria_contract_findings.
 * This table survives search deletions and acts as a growing cross-reference layer.
 * Upserts on (provider_name, property_address) so confidence can only improve, never regress.
 * Completely non-blocking — never throws, never delays the response.
 */
async function persistContractFindings(
  prospects: any[],
  searchId: string | null,
): Promise<void> {
  try {
    const rows: Record<string, unknown>[] = []

    for (const prospect of prospects) {
      const prop  = prospect?.property ?? {}
      const own   = prospect?.ownership ?? {}
      const bulks: any[] = prop.bulk_agreements ?? []

      for (const b of bulks) {
        if (!b.provider) continue
        // Only persist medium-confidence or better — never pollute with low guesses
        if (b.confidence === 'low') continue

        // Parse expiry year from the estimate string (e.g. "~2027", "Q2 2026", "2028")
        const expiryYearMatch = (b.expiry_estimate ?? '').match(/20\d{2}/)
        const expiryYear = expiryYearMatch ? parseInt(expiryYearMatch[0], 10) : null

        // Parse effective date from wayback_first_seen or ucc_filing_date if available
        const effectiveDateStr = b.ucc_filing_date || b.wayback_first_seen || null
        const expiryDateStr = (expiryYear && !b.expiry_estimate?.includes('unknown'))
          ? `${expiryYear}-01-01`  // approximate — just the year
          : null

        // Extract state from address (last 2 uppercase chars before zip or end of string)
        const addressState = (prop.address ?? '').match(/\b([A-Z]{2})\b\s*\d{0,5}$/)?.[1] ?? null

        rows.push({
          property_name:      prop.name       || null,
          property_address:   prop.address    || null,
          property_state:     addressState,
          management_company: prop.management_company || null,
          owner_entity:       prop.owner_entity || own.owner_entity || null,
          dnb_duns:           own.dnb_duns    || null,

          provider_name:      b.provider,
          provider_type:      b.service_type === 'video' ? 'video' : 'isp',
          agreement_type:     b.agreement_type  || 'unknown',
          service_type:       b.service_type    || 'internet',

          effective_date:     effectiveDateStr || null,
          expiry_date:        expiryDateStr    || null,
          expiry_year:        expiryYear,
          wayback_first_seen: b.wayback_first_seen || null,
          ucc_filing_date:    b.ucc_filing_date    || null,
          source_url:         b.source_url         || null,
          source_snippet:     b.source_snippet     ? b.source_snippet.slice(0, 500) : null,

          source_type:        'aria',  // will be overridden if we can detect the specific source
          confidence:         b.confidence || 'medium',

          found_by_search_id: searchId || null,
          verified:           b.confidence === 'confirmed',
          verified_by:        b.confidence === 'confirmed' ? 'aria' : null,
        })
      }
    }

    if (rows.length === 0) return

    await supabase
      .from('aria_contract_findings')
      .upsert(rows, {
        onConflict:       'provider_name,property_address',
        ignoreDuplicates: false,  // update if confidence improves
      })
  } catch {
    // Completely non-blocking — must never affect response
  }
}

/**
 * Query aria_contract_findings for pre-existing contract data on the search target.
 * Returns a formatted context block injected into Claude's prompt BEFORE web research,
 * giving Claude a head start on known contract dates from prior searches.
 */
async function queryContractFindings(terms: string): Promise<string> {
  try {
    if (terms.length < 4) return ''
    const { data } = await supabase
      .from('aria_contract_findings')
      .select('provider_name, agreement_type, service_type, expiry_year, expiry_date, confidence, source_type, wayback_first_seen, ucc_filing_date, management_company, owner_entity, dnb_duns')
      .or(`property_name.ilike.%${terms}%,property_address.ilike.%${terms}%,management_company.ilike.%${terms}%`)
      .in('confidence', ['confirmed', 'high', 'medium-high', 'medium'])
      .order('confidence', { ascending: false })
      .limit(12)

    if (!data || data.length === 0) return ''

    const lines = data.map((r: any) => {
      const expiry = r.expiry_date
        ? `expires ${r.expiry_date.slice(0, 7)}`
        : r.expiry_year
        ? `est. expires ~${r.expiry_year}`
        : 'expiry unknown'
      const dateDetail = r.ucc_filing_date
        ? ` | UCC filed ${r.ucc_filing_date}`
        : r.wayback_first_seen
        ? ` | Wayback first-seen ${r.wayback_first_seen}`
        : ''
      const duns = r.dnb_duns ? ` | D&B DUNS: ${r.dnb_duns}` : ''
      return `• ${r.provider_name} (${r.service_type}/${r.agreement_type}) — ${expiry} — ${r.confidence} confidence [${r.source_type}]${dateDetail}${duns}`
    })
    return `\n\nGATEGUARD CONTRACT FINDINGS DATABASE — Prior data for "${terms}":\n(Accumulated from previous ARIA searches — treat as established prior evidence)\n${lines.join('\n')}\nIMPORTANT: If new web research contradicts these findings, flag the conflict. If it confirms them, upgrade confidence to "confirmed".\n`
  } catch {
    return ''
  }
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
          required: ['property', 'decision_maker', 'decision_maker_chain', 'pain_signals', 'profile', 'scout_brief'],
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
                      provider:           { type: 'string' },
                      service_type:       { type: 'string', enum: ['internet', 'video', 'bundled'] },
                      agreement_type:     { type: 'string', enum: ['exclusive', 'bulk', 'preferred', 'unknown'] },
                      expiry_estimate:    { type: 'string', description: 'e.g. "Q2 2026", "~2027", "unknown"' },
                      confidence:         { type: 'string', enum: ['confirmed', 'high', 'medium', 'low'] },
                      wayback_first_seen: { type: 'string', description: 'Date ISP portfolio page first crawled by Wayback Machine (YYYY-MM-DD) — proxy for deal launch date. Source: WAYBACK CDX data above.' },
                      ucc_filing_date:    { type: 'string', description: 'UCC-1 financing statement filing date (YYYY-MM-DD) if found — legal record of exact deal start. Source: UCC-FILING results above.' },
                      source_url:     { type: 'string', description: 'URL of the source document where this agreement was found. REQUIRED when source is contract-pdf, county-deed, ucc-filing, or offering-memo. Copy verbatim from the [URL: ...] line in the web intelligence block. This URL is saved permanently in the GateGuard contract findings database so the team can retrieve the original document at any time.' },
                      source_snippet: { type: 'string', description: 'Verbatim excerpt (max 300 chars) from the source document confirming this agreement. Must contain the provider name plus at least one of: term length, expiry date, effective date, or ISP name. Leave empty string if no direct quote available.' },
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
              required: ['name', 'title', 'company', 'role_type', 'linkedin_slug', 'email', 'top_email_format', 'phone', 'tenure_years'],
              properties: {
                name:             { type: 'string' },
                title:            { type: 'string' },
                company:          { type: 'string' },
                role_type:        { type: 'string', enum: ['asset_manager','regional_manager','property_manager','owner','unknown'], description: 'Hierarchy role — asset_manager is highest priority target' },
                linkedin_slug:    { type: 'string' },
                email:            { type: 'string', description: 'Best guess at actual email address (e.g. john.smith@greystar.com)' },
                top_email_format: { type: 'string', description: 'Single highest-probability email format with confidence %. Format: "firstname.lastname@greystar.com — 78% (Greystar standard pattern for VPs)". Use Hunter.io-style domain pattern inference. Common patterns: VPs/Directors=firstname.lastname, C-suite=f.lastname or firstname, PMs=fLastname. Always include % and the pattern rationale.' },
                phone:            { type: 'string' },
                tenure_years:     { type: 'number' },
              },
            },
            decision_maker_chain: {
              type: 'array',
              description: 'REQUIRED — always populate all 3 tiers: owner/PE, asset_manager, regional_manager. Most powerful listed first. Use web evidence + knowledge to find real names and emails.',
              items: {
                type: 'object',
                required: ['name', 'title', 'company', 'role_type', 'email', 'top_email_format'],
                properties: {
                  name:             { type: 'string' },
                  title:            { type: 'string' },
                  company:          { type: 'string' },
                  role_type:        { type: 'string', enum: ['owner','asset_manager','regional_manager','property_manager','unknown'] },
                  linkedin_slug:    { type: 'string', description: 'LinkedIn profile slug or empty string' },
                  email:            { type: 'string', description: 'Best guess at actual email address' },
                  top_email_format: { type: 'string', description: 'Single highest-probability email format with confidence %. Format: "firstname.lastname@company.com — 78% (company uses firstname.lastname for senior staff)". Infer from known contacts at this company/domain.' },
                  phone:            { type: 'string' },
                  notes:            { type: 'string', description: 'Why this person matters (e.g. "controls capex for 12-property portfolio")' },
                  dm_hooks: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'CRITICAL FOR EMAIL PERSONALIZATION. Recent (last 12 months) public posts, articles, conference appearances, quotes, or professional announcements from this specific person that reveal their priorities, passions, and current focus. Source from [DM-SOCIAL] results. Examples: "Posted about reducing liability exposure with smart access", "Spoke at NMHC about value-add NOI strategy in Southeast", "LinkedIn post: excited to close 400-unit acquisition in Austin", "Shared article about tech driving resident retention". These hooks become the FIRST SENTENCE of the personalized email variant targeting this individual.',
                  },
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
                dnb_duns:        { type: 'string', description: 'D&B DUNS number (9-digit Dun & Bradstreet identifier) for the owner entity if found in UCC-1 filings, OpenCorporates, or other public records. Format: "XXXXXXXXX" or "unknown".' },
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
            scout_brief: {
              type: 'object',
              description: 'Structured intelligence handoff for SCOUT to generate outreach campaign. ARIA collects data — SCOUT writes emails.',
              required: ['primary_contact', 'outreach_angle', 'contract_window_urgency', 'key_data_points'],
              properties: {
                primary_contact:          { type: 'string', description: 'Name + title of highest-priority contact for SCOUT to email first (typically asset_manager). e.g. "Sarah Chen, Asset Manager, Blackstone Real Estate"' },
                outreach_angle:           { type: 'string', enum: ['contract_window', 'proptech_pain', 'acquisition', 'tech_displacement', 'sara_bridge', 'upgrade_path', 'lease_up', 'general'], description: 'Single strongest angle SCOUT should lead with' },
                contract_window_urgency:  { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'none'], description: 'Derived from telecom contract expiry timing — drives urgency level in SCOUT campaign' },
                key_data_points:          { type: 'array', items: { type: 'string' }, description: '3–5 specific, verifiable data points SCOUT should reference. Examples: "Gigstreem exclusive deal, est. expires ~2026 (Wayback CDX)", "Gate complaint: \'gate stuck open for 2 weeks\' — Google Reviews Nov 2024", "Acquired by Blackstone Q2 2024 per Bisnow", "Sarah Chen posted LinkedIn about NOI strategy at Southeast portfolio"' },
              },
            },
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
    // Contract date intelligence (Wayback CDX + SEC EDGAR + UCC)
    let waybackBlock    = ''
    let edgarBlock      = ''
    let priorFindings   = ''  // from aria_contract_findings DB — pre-existing contract data

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
          // Fetch ALL active providers — ISPs and video providers alike.
          // deriveDomain() will resolve a searchable domain for each, either from their
          // URL pattern or from a slug-based fallback. Providers with no resolvable domain
          // are silently skipped in the search loop below.
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

        // ── Wayback Machine CDX — timestamp ISP portfolio pages ──
        // For every provider with a known domain, check if the management company portfolio page
        // (e.g. gigstreem.com/amli/) exists in the Wayback archive and when it was first crawled.
        // First-crawl date ≈ deal launch date → + 8yr typical MDU term = expiry estimate.
        // Only run when a management company slug was detected in the query.
        if (providers && providers.length > 0) {
          const mgmtSlug = extractMgmtCoSlug(query)
          if (mgmtSlug && mgmtSlug.length > 2) {
            const waybackChecks: Promise<WaybackResult | null>[] = []
            const checkedDomains = new Set<string>()

            for (const p of providers) {
              const domain = deriveDomain(p as { slug: string; property_page_pattern: string | null; operator_page_pattern: string | null })
              if (!domain || checkedDomains.has(domain)) continue
              checkedDomains.add(domain)
              // Check: isp.com/mgmtco/ — this is the portfolio page we're looking for
              waybackChecks.push(checkWaybackTimestamp(`https://${domain}/${mgmtSlug}/`))
            }

            // Run all Wayback checks in parallel (capped at 10 to avoid overloading free API)
            const waybackResults = await Promise.allSettled(waybackChecks.slice(0, 10))
            const found: WaybackResult[] = []
            for (const r of waybackResults) {
              if (r.status === 'fulfilled' && r.value) found.push(r.value)
            }

            if (found.length > 0) {
              const lines = found.map(r =>
                `• ${r.url} — first crawled ${r.firstSeen} → expiry estimate: ${r.estimatedExpiry}`
              )
              waybackBlock = `\n\nWAYBACK MACHINE CDX — ISP portfolio page first-crawl timestamps:\n(First-crawl date ≈ deal announcement date; deal_start_year + 8yr typical MDU term = expiry estimate)\n${lines.join('\n')}\n`
            }
          }
        }
      } catch { /* non-blocking */ }
    })()

    // ── Prior contract findings (DB cache) — query before web searches so Claude gets head start ──
    const priorFindingsPromise = (async () => {
      priorFindings = await queryContractFindings(searchTerms)
    })()

    // ── SEC EDGAR full-text search — REIT/public company bulk telecom disclosures ──
    // REITs and public management companies (Equity Residential, AvalonBay, UDR, MAA, Camden) must
    // disclose material bulk internet/cable agreements in 10-K and 10-Q SEC filings.
    // These filings often name the ISP, deal term, and dollar value — making them gold for expiry calc.
    // Non-blocking; result injected into Claude's prompt if found.
    const edgarPromise = (async () => {
      const mgmtCo = extractMgmtCoSlug(query) ?? ''
      const result = await searchEdgarBulkAgreements(searchTerms, mgmtCo)
      if (result) edgarBlock = result
    })()

    // Tavily OSINT searches — 22 parallel sources + provider slug pages, non-blocking if no API key
    const tavilyPromise = (async () => {
      if (!process.env.TAVILY_API_KEY) return
      const loc = locationHint || ''
      const terms = searchTerms
      // Management company target for decision-maker social research — prefer short slug ("amli"),
      // fall back to full search terms when no known mgmt co is detected.
      const mgmtTarget = extractMgmtCoSlug(query) || terms

      const [
        listingSites,        //  1. Apartment listing sites — "internet included" + provider
        socialSignals,       //  2. Reddit/ApartmentRatings — exclusivity signals  (last 12 months)
        countyRecords,       //  3. County deed/easement records — ISP MDU agreements on title
        mduAnnouncements,    //  4. ISP/PCO MDU partnership announcements
        commercialRE,        //  5. Offering Memoranda (LoopNet/Crexi) — "ancillary income" gold mine
        hoaRfpDocs,          //  6. HOA meeting minutes + RFPs — explicit contract expiry dates
        linkedinMduReps,     //  7. LinkedIn MDU account executive win posts + americantv.com
        locatorSites,        //  8. Third-party locator sites — fee breakdowns exposing bundled charges
        forcedService,       //  9. Forced-service resident complaints  (last 12 months)
        jobPostings,         // 10. Job listings for community managers listing telecom systems they manage
        reitEarnings,        // 11. REIT earnings calls + investor docs — portfolio-wide MDU rollout announcements
        cityPermits,         // 12. City low-voltage / telecom permits — ISPs pull permits when installing bulk
        communitySocial,     // 13. Property social media — ISP partnership announcements  (last 12 months)
        ispPressRelease,     // 14. ISP press releases naming the property + contract term length → exact expiry calc
        historicalListing,   // 15. Older/archived listings revealing prior provider (switch = prior contract expired)
        dmRegionalManager,   // 16. Regional manager / VP social intel — what are they posting about lately?
        dmAssetOwner,        // 17. Asset manager / owner activity — investment thesis, capex signals
        proptechPain,        // 18. Hardware pain signals — gate, camera, package, water, access complaints
        acquisitionSignals,  // 19. Property acquisition / ownership change — new owner = open vendor window
        techStackSignals,    // 20. PMS + incumbent proptech vendors — integration angle + displacement targets
        uccFilings,          // 21. UCC-1 financing statements — ISP as secured party = deal start date + D&B number
        openCorporates,      // 22. OpenCorporates / D&B lookup — ownership entity + DUNS numbers
        contractDorkBase,    // 23. Google Dork: raw "right of entry" + "bulk services agreement" PDFs
        contractDorkHoa,     // 24. Google Dork: HOA/condo "telecommunications easement" PDFs
        contractDorkExhibit, // 25. Google Dork: "Exhibit A" master communications agreement PDFs with dates
        contractDorkFiltered,// 26. Google Dork: executed MDU agreements for major mgmt cos — no templates
        countyRecorderIndex, // 27. Nationwide county recorder / real estate index — telecom easements on title
      ] = await Promise.all([

        // 1. Listing sites — most reliable for confirming "internet included" + exact provider
        // NOTE: Include both "Gigstreem" (correct) and "Gigastream" (common typo) — both appear in wild
        tavilySearch(
          `"${terms}" ${loc} "internet included" OR "bulk internet" OR "fiber included" OR "internet by" OR "Comcast included" OR "Spectrum included" OR "AT&T included" OR "DirecTV included" OR "DISH included" OR "Gigstreem included" OR "Gigastream included" OR "Hotwire included" OR "Boingo included" site:apartments.com OR site:apartmentlist.com OR site:rent.com OR site:zillow.com OR site:apartmentratings.com OR site:americantv.com`,
          4, 'listing-site'),

        // 2. Reddit/reviews — "only option" + forced-provider language = exclusive bulk deal
        // LAST 12 MONTHS — stale complaints may no longer reflect the current contract status
        tavilySearch(
          `"${terms}" ${loc} internet "only option" OR "can't use another" OR "forced to use" OR "included in rent" OR "only ISP" OR "building internet" OR "DirecTV bulk" OR "DISH bulk" OR "Spectrum bulk" OR "Gigstreem" OR "Gigastream" OR "Hotwire" OR "bulk wifi" OR "community wifi" site:reddit.com OR site:apartmentratings.com OR site:yelp.com OR site:google.com/maps`,
          5, 'social', 365),

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
        // LAST 12 MONTHS — recent complaints confirm the deal is still active today
        tavilySearch(
          `"${terms}" ${loc} ("forced to use" OR "have to use" OR "only option" OR "can't switch" OR "required to pay for" OR "no choice" OR "stuck with" OR "mandatory" OR "can't cancel") ("DirecTV" OR "Spectrum" OR "Comcast" OR "AT&T" OR "internet" OR "cable" OR "Gigstreem" OR "Gigastream" OR "DISH" OR "Hotwire" OR "Boingo") -site:cortland.com -site:apartments.com -site:cortlandliving.com`,
          4, 'forced-service', 365),

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
        // LAST 12 MONTHS — only recent announcements are actionable for outreach timing
        tavilySearch(
          `"${terms}" ${loc} "excited to announce" OR "thrilled to announce" OR "new internet" OR "new WiFi" OR "new partnership" OR "now offering" OR "bulk internet" OR "community WiFi" OR "included internet" "DirecTV" OR "Spectrum" OR "Comcast" OR "AT&T" OR "Gigstreem" OR "Gigastream" OR "Hotwire" OR "Boingo" OR "WhiteSky" OR "Wyyerd" site:facebook.com OR site:nextdoor.com OR site:instagram.com OR site:twitter.com OR site:x.com`,
          3, 'community-social', 365),

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

        // 16. Regional manager / VP social intel — what are they excited about RIGHT NOW?
        // LAST 12 MONTHS — used to personalize email opening lines with a real, recent hook.
        // e.g., "Saw your post about resident retention driving renewals at your Atlanta portfolio..."
        // Bisnow/MultifamilyExecutive profiles reveal speaking topics, market focus, and current priorities.
        tavilySearch(
          `"${mgmtTarget}" "regional manager" OR "regional VP" OR "vice president" OR "director of operations" OR "regional director" multifamily "${loc || 'multifamily'}" (posted OR "proud to" OR "excited about" OR "thrilled" OR "just announced" OR "happy to share" OR "honored to" OR "speaking at" OR "panelist" OR "presenting at" OR "joining" OR "team is") site:linkedin.com OR site:bisnow.com OR site:multifamilyexecutive.com OR site:nmhc.org`,
          4, 'dm-social', 365),

        // 17. Asset manager / owner intel — investment thesis, capex signals, portfolio-level news
        // LAST 12 MONTHS — asset managers post about acquisitions, value-add strategies, NOI targets.
        // Referencing their stated investment thesis in the first sentence of an email is the strongest
        // possible personalization signal: "Your Q4 value-add push across the Southeast portfolio..."
        tavilySearch(
          `"${mgmtTarget}" ${loc} "asset manager" OR "portfolio manager" OR "managing director" OR "chief investment officer" OR "principal" OR "general partner" OR "co-founder" multifamily (invest OR acquisition OR "value-add" OR renovation OR capex OR "NOI" OR "net operating income" OR "lease-up" OR "rent growth" OR "repositioning") site:linkedin.com OR site:bisnow.com OR site:globest.com OR site:multifamilydive.com OR site:prnewswire.com`,
          4, 'dm-social', 365),

        // 18. Proptech hardware pain signals — the most direct purchase triggers for gates, cameras,
        // smart locks, intercoms, access control, water sensors, and package management.
        // A salesperson reading "gate stuck open 3 weeks in a row" knows exactly what to sell and why.
        // LAST 12 MONTHS — stale complaints may have been resolved; fresh ones mean active pain.
        // Excludes official property sites to surface unsolicited resident feedback only.
        tavilySearch(
          `"${terms}" ${loc} ("gate broken" OR "gate stuck" OR "gate won't open" OR "gate won't close" OR "fob doesn't work" OR "key fob stopped" OR "intercom broken" OR "intercom doesn't work" OR "no cameras" OR "camera not working" OR "package stolen" OR "package theft" OR "packages stolen" OR "water damage" OR "flooding" OR "water leak" OR "pipe burst" OR "no smart lock" OR "mailbox broken" OR "parking chaos" OR "unauthorized access" OR "break-in" OR "someone got in" OR "security concerns" OR "no security") site:reddit.com OR site:apartmentratings.com OR site:yelp.com OR site:google.com/maps OR site:apartments.com`,
          5, 'proptech-pain', 365),

        // 19. Property acquisition / ownership change — new owners = new hardware relationships.
        // A property acquired 6–18 months ago is in the sweet spot: budget available, vendor loyalty low.
        // CoStar, LoopNet, Bisnow deal announcements, county deed recordings, and REIT 8-Ks all surface this.
        // The pitch angle: "Your predecessor had a 10-year legacy contract — that's yours to renegotiate now."
        tavilySearch(
          `"${terms}" ${loc} multifamily (acquired OR "sold for" OR "sells for" OR "purchase price" OR "closed" OR "transaction" OR "new ownership" OR "under new management" OR "new owner" OR "recently sold" OR "deed transfer" OR "cap rate") site:bisnow.com OR site:globest.com OR site:costar.com OR site:loopnet.com OR site:multifamilydive.com OR site:prnewswire.com OR site:businesswire.com`,
          4, 'acquisition'),

        // 20. PMS + competing proptech stack — the management software and smart-apartment vendors
        // already installed tell the salesperson what ecosystem to integrate with and who the incumbent is.
        // Yardi/RealPage/Entrata = enterprise operator. AppFolio = mid-market. SmartRent/Latch = direct
        // competitors to GateCard. ButterflyMX = intercom incumbent. Verkada = camera incumbent.
        // Also catches renovation/new-construction signals: "now leasing" + new permits = open window.
        tavilySearch(
          `"${terms}" ${loc} ("Yardi" OR "RealPage" OR "Entrata" OR "AppFolio" OR "MRI Software" OR "Knock CRM" OR "SmartRent" OR "Latch" OR "ButterflyMX" OR "Verkada" OR "Salto" OR "Openpath" OR "Brivo" OR "HID Global" OR "LiftMaster" OR "DoorKing" OR "Package Concierge" OR "Luxer One" OR "Amazon Hub" OR "now leasing" OR "grand opening" OR "newly renovated" OR "value-add renovation")`,
          4, 'tech-stack'),

        // 21. UCC-1 financing statements — ISPs file UCC-1s against property owners when signing MDU deals.
        // The ISP is the "secured party", the property owner is the "debtor", filing date = deal start date.
        // State SOS portals (TX, NY, IL, FL, CA, DE) publish these publicly and get indexed by Google.
        // Also catches public lien/filing aggregators that index UCC data across all 50 states.
        // D&B DUNS number often appears in the debtor description field of the UCC record.
        tavilySearch(
          `"${mgmtTarget}" OR "${terms}" ${loc} "UCC" OR "UCC-1" OR "financing statement" OR "secured party" ("internet" OR "broadband" OR "telecommunications" OR "cable") site:sos.state.tx.us OR site:ucc.dos.ny.gov OR site:apps.ilsos.gov OR site:sunbiz.org OR site:sos.ca.gov OR site:ucc.delaware.gov OR "financing statement" OR "UCC filing" OR "DUNS" OR "D&B"`,
          4, 'ucc-filing'),

        // 22. OpenCorporates / D&B business entity lookup — ownership entities + D&B DUNS numbers.
        // OpenCorporates indexes business registration data across all US states + D&B DUNS identifiers.
        // DUNS number is used in federal contracting, credit checks, and as a universal entity identifier.
        // Also surfaces parent company structures (LLC → parent LP → PE fund) for the ownership chain.
        tavilySearch(
          `"${mgmtTarget}" multifamily "DUNS" OR "D-U-N-S" OR "Dun & Bradstreet" OR "business entity" OR "registered agent" OR "principal address" OR "general partner" OR "managing member" site:opencorporates.com OR site:dnb.com OR site:bizapedia.com OR site:cortera.com OR site:open.fec.gov`,
          3, 'dnb-lookup'),

        // 23. GOOGLE DORK — Baseline "right of entry" + "bulk services agreement" PDFs.
        // ISPs and property owners file these with county recorders, HOA portals, and municipal permit systems.
        // The signed PDF contains: ISP name, property address, effective date, term length, termination date.
        // filetype:pdf forces search engines to index only raw PDF documents — not marketing pages.
        // Rotate provider names across Charter/Spectrum/Comcast/Cox/AT&T to maximize coverage.
        // GOLD: Search result = actual executed contract, not a summary. Open and ctrl+F "term" or "expiration".
        tavilySearch(
          `filetype:pdf ("right of entry agreement" OR "bulk services agreement" OR "bulk internet agreement" OR "MDU service agreement" OR "multi-dwelling unit agreement") ("${terms}" OR "${loc}") (Spectrum OR Charter OR Comcast OR Xfinity OR Cox OR "AT&T" OR Hotwire OR Gigstreem OR Gigastream OR "Pavlov Media" OR "Spot On Networks" OR Wyyerd OR Bsquared OR Boingo OR WideOpenWest OR WOW OR Metronet OR Vyve OR Brightspeed OR Ting OR Consolidated OR "Google Fiber" OR Lumen OR CenturyLink OR Kinetic OR Ziply) "term" OR "expiration" OR "effective date"`,
          4, 'contract-pdf'),

        // 24. GOOGLE DORK — HOA and condominium board "telecommunications easement" PDFs.
        // HOA boards file telecom easement agreements with county recorders when they grant ISPs permanent
        // right-of-way. These are PUBLIC RECORD — fully indexed by Google because they're on .gov domains.
        // High-yield source: HOA meeting minutes + accompanying easement PDFs explicitly state expiry year.
        // Search pattern targets condominium and HOA entities, not individual apartment buildings.
        tavilySearch(
          `filetype:pdf ("telecommunications easement" OR "cable television easement" OR "broadband easement" OR "fiber easement" OR "right of entry" OR "license agreement") (Comcast OR Xfinity OR Charter OR "AT&T" OR Cox OR Spectrum OR DirecTV OR Hotwire OR Gigstreem OR Gigastream OR "Pavlov Media" OR "Spot On Networks" OR Wyyerd OR Boingo OR WideOpenWest OR Metronet OR Vyve OR Brightspeed OR Ting OR Consolidated) ("homeowners association" OR "HOA" OR "condominium" OR "condo association" OR "property owners association" OR "multifamily" OR "apartment") ("${loc}" OR "${mgmtTarget}")`,
          4, 'contract-pdf'),

        // 25. GOOGLE DORK — "Exhibit A" master communications agreement PDFs.
        // Large ISPs structure portfolio deals as a Master Agreement + property-specific Exhibits.
        // The Exhibit contains the specific term, monthly fee, and termination date for each property.
        // These leak onto HOA back-end portals, municipal filing systems, and property management intranets.
        // Critical filter: only look for executed agreements — EXCLUDE templates, blanks, and samples.
        tavilySearch(
          `filetype:pdf ("exhibit a" OR "exhibit b" OR "schedule a") ("master communications agreement" OR "master bulk agreement" OR "master services agreement") MDU ("effective date" OR "expiration date" OR "initial term" OR "renewal term") -template -sample -blank -"insert date" -"[date]"`,
          4, 'contract-pdf'),

        // 26. GOOGLE DORK — Executed MDU bulk agreements for major management companies.
        // NOTE: Also includes regional ISPs (Gigstreem/Gigastream, Hotwire, Pavlov Media, Spot On,
        // Wyyerd, Boingo, WideOpenWest, Metronet, Vyve, Brightspeed) alongside national giants.
        // One executed PDF for a major management company reveals the contract structure
        // (and likely term length) for dozens of properties in their portfolio.
        // Exclude blanks/templates so every result is a real executed contract with actual dates.
        tavilySearch(
          `filetype:pdf ("bulk services agreement" OR "right of entry" OR "telecommunications agreement" OR "Internet services agreement" OR "MDU service agreement") (Greystar OR "Lincoln Property" OR Cortland OR AMLI OR "Equity Residential" OR "AvalonBay" OR Camden OR Bozzuto OR MAA OR "RPM Living" OR "${mgmtTarget}" OR Comcast OR Xfinity OR Spectrum OR Charter OR Cox OR Hotwire OR Gigstreem OR Gigastream OR "Pavlov Media" OR "Spot On Networks" OR Wyyerd OR Boingo OR WideOpenWest OR Metronet OR Vyve OR Brightspeed) "expiration" OR "term expires" OR "initial term" OR "renewal" -template -sample -blank`,
          4, 'contract-pdf'),

        // 27. NATIONWIDE COUNTY RECORDER / REAL ESTATE INDEX — telecom easements on property title.
        //
        // CONCEPT (originally GSCCCA for Georgia, expanded nationwide):
        // When an ISP signs a bulk MDU deal, they record a TELECOMMUNICATIONS EASEMENT on the property
        // title at the county recorder's office. This protects their infrastructure investment if the
        // building is sold — the easement runs with the land. Because it's recorded on title, it is
        // a 100% public document searchable by grantor (property owner) or grantee (ISP).
        //
        // STATE EQUIVALENTS of GSCCCA (Georgia Superior Courts Clerk Cooperative Authority):
        //   GA: gsccca.org          | FL: myFloridaCounty.com / OR search
        //   TX: county clerk sites  | CA: county recorder sites
        //   NY: ACRIS (NYC) or county clerks | IL: Cook County Recorder
        //   NC: Register of Deeds   | AZ: county recorder
        //   NV: county recorder     | CO: county assessor
        //   WA: county auditor      | OH: county recorder
        //
        // Search targets these indexed portals + aggregators (PropertyShark, PublicDataDigger, etc.)
        // that pull from multiple state/county systems and make them Googleable.
        tavilySearch(
          `("telecommunications easement" OR "right of entry" OR "cable television franchise" OR "broadband easement" OR "fiber optic easement" OR "telecom license agreement") ("${terms}" OR "${mgmtTarget}") ${loc} grantee (Comcast OR Xfinity OR Spectrum OR Charter OR Cox OR "AT&T" OR Hotwire OR Gigstreem OR Gigastream OR "Pavlov Media" OR "Spot On Networks" OR Wyyerd OR Boingo OR WideOpenWest OR Metronet OR Vyve OR Brightspeed OR Ting OR Consolidated OR "Google Fiber" OR Lumen OR CenturyLink) site:gsccca.org OR site:myfloridacounty.com OR site:acris.nyc.gov OR site:propertyshark.com OR "county recorder" OR "deed of easement" OR "instrument number"`,
          5, 'county-deed'),
      ])

      // Provider slug page searches — apply the Gigstreem/AMLI loci to EVERY provider in mdu_providers.
      //
      // METHODOLOGY (confirmed via AMLI Marina Del Rey investigation, May 2026):
      // ISPs and video providers with portfolio-level MDU deals create BOTH property-specific pages
      // AND management company landing pages on their own domains:
      //   gigstreem.com/amli/         → all AMLI properties
      //   hotwire.com/multifamily/    → their MDU portfolio
      //   boingo.com/multifamily/     → Boingo MDU partners
      //
      // TWO searches per provider per query:
      //   Search A: `"${propertyTerms}" site:${domain}` → property-specific pages
      //   Search B: `"${mgmtCoSlug}" site:${domain}`   → portfolio/management-company pages
      //
      // Both ISPs and video providers are searched — the database is the sole source of truth.
      // No hardcoded domain lists — all domains are derived from mdu_providers via deriveDomain().
      const mgmtCoSlug = extractMgmtCoSlug(query) // e.g. "AMLI" → "amli", "Greystar" → "greystar"
      const providerSlugResults: TavilyResult[] = []

      if (mduProviderSlugs.length > 0) {
        const slugSearches: Array<Promise<TavilyResult[]>> = []

        for (const p of mduProviderSlugs) {
          const domainOnly = deriveDomain(p)
          if (!domainOnly) continue // skip providers with no resolvable domain

          // Search A: full property name on this provider's domain (finds property-specific pages)
          slugSearches.push(tavilySearch(`"${terms}" site:${domainOnly}`, 2, 'provider-slug'))

          // Search B: management company slug on this provider's domain (finds portfolio-level pages)
          // This is the KEY loci: gigstreem.com/amli/ was found via `"amli" site:gigstreem.com`
          // Applies identically to every ISP and video provider in the database
          if (mgmtCoSlug && mgmtCoSlug.length > 2) {
            slugSearches.push(tavilySearch(`"${mgmtCoSlug}" site:${domainOnly}`, 2, 'provider-slug'))
          }
        }

        const slugResponses = await Promise.allSettled(slugSearches)
        for (const res of slugResponses) {
          if (res.status === 'fulfilled') providerSlugResults.push(...res.value)
        }
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
        ...dmRegionalManager,
        ...dmAssetOwner,
        ...proptechPain,
        ...acquisitionSignals,
        ...techStackSignals,
        ...uccFilings,
        ...openCorporates,
        ...contractDorkBase,
        ...contractDorkHoa,
        ...contractDorkExhibit,
        ...contractDorkFiltered,
        ...countyRecorderIndex,
      ]
        .filter(r => r.score > 0.20)
        .sort((a, b) => {
          const boostMap: Record<string, number> = {
            'provider-slug':      0.40, // ISP's own property page = highest confidence
            'county-deed':        0.35,
            'isp-press-release':  0.38, // ISP PR + property name + term → direct expiry calc
            'contract-pdf':       0.45, // Executed contract PDF = raw signed document, highest possible accuracy
            'ucc-filing':         0.36, // UCC-1 = legal filing with exact deal start date + D&B number
            'commercial-re':      0.30,
            'dm-social':          0.30, // DM social posts → email personalization hooks
            'city-permit':        0.28,
            'proptech-pain':      0.27, // Hardware pain = direct purchase trigger (gate, camera, package)
            'acquisition':        0.26, // New ownership = open vendor relationship window
            'hoa-rfp':            0.25,
            'reit-earnings':      0.25,
            'tech-stack':         0.24, // PMS + incumbent vendor intel → integration/displacement angle
            'locator-site':       0.22,
            'community-social':   0.22,
            'dnb-lookup':         0.22, // D&B / OpenCorporates → ownership chain + DUNS number
            'listing-site':       0.20,
            'job-posting':        0.20,
            'historical-listing': 0.20,
            'forced-service':     0.18,
            'linkedin-mdu':       0.15,
            'isp-partnership':    0.10,
            social:               0.05,
          }
          const aBoost = boostMap[a.source ?? ''] ?? 0
          const bBoost = boostMap[b.source ?? ''] ?? 0
          return (b.score + bBoost) - (a.score + aBoost)
        })
        .slice(0, 40)

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
        'dm-social':          'DM-SOCIAL',
        'proptech-pain':      'PROPTECH-PAIN',
        'acquisition':        'ACQUISITION',
        'tech-stack':         'TECH-STACK',
        'ucc-filing':         'UCC-FILING',
        'dnb-lookup':         'DNB-LOOKUP',
        'contract-pdf':       'CONTRACT-PDF',
        web:              'WEB',
      }

      tavilyContextBlock = `\n\nWEB INTELLIGENCE — Live OSINT (27 sources — executed contract PDFs, county recorder easements, ISP/video contracts, decision maker intel, proptech pain, acquisition timing, tech stack, UCC filings, D&B):
${allResults.map((r) => `[${sourceLabels[r.source ?? 'web'] ?? 'WEB'}] ${r.title}\nURL: ${r.url}\n${r.content.slice(0, 800)}`).join('\n\n---\n\n')}

SIGNAL EXTRACTION RULES (apply in this priority order):
0b. [CONTRACT-PDF] Raw executed contract PDF found via Google Dork (filetype:pdf) — this is the actual signed document, not a summary page. HIGHEST ACCURACY SOURCE.
  - Extract: ISP/provider name, property address (confirm it matches the target), effective date, initial term (years), termination/expiration date or renewal clause
  - EXPIRY CALC: effective_date + initial_term_years = exact expiry. Output as: "[month] [year] (exact — from executed contract PDF, [URL])"
  - If the PDF contains "auto-renewal" or "evergreen" language → note the auto-renewal period and next cancellation window
  - Template/blank forms DO NOT contain actual dates — discard any result where effective date reads "[date]", "[insert date]", or "____". These are worthless.
  - confidence="confirmed" — this is the actual signed document, not marketing
  - CONTRACT AUDIT WINDOW RULE (CRITICAL FOR EMAIL ANGLE): A property actively reviewing its telecom contract is simultaneously auditing its ENTIRE low-voltage footprint — gates, cameras, access control, intercoms. This is the highest-value outreach window GateGuard has. When a contract-pdf result is found AND expiry is within 24 months, set profile.contract_window="active" AND set profile.urgency to at least "high". Use the email angle: "Property managers auditing their broadband contract are simultaneously evaluating their full low-voltage footprint — we should be in that conversation."
  - DOCUMENT STORAGE: Always populate bulk_agreements[].source_url with the exact URL from the [URL: ...] line. This is stored permanently in the GateGuard contract findings database for the team to retrieve.
  - Always populate bulk_agreements[].source_snippet with a verbatim excerpt (max 300 chars) from the document that confirms the agreement — quote the sentence containing the provider name + term or expiry.
0. [PROVIDER-SLUG-PAGE] ISP's own property or operator portal page for this property → confidence="confirmed", agreement_type="bulk" — this is the highest-confidence source possible
1. [COUNTY-DEED] names ISP + "memorandum/easement/agreement" + dates → confidence="high", extract expiry_estimate from term length. Always populate source_url + source_snippet with the deed URL and the confirming text from the instrument.
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

18. [DM-SOCIAL] LinkedIn/Bisnow/MultifamilyExecutive posts from regional managers, asset managers, or owners → extract: name + title, recent posts/announcements, topics they care about. Populate dm_hooks[] on matching decision_maker_chain entry. Format: "Posted about...", "Spoke at NMHC on...", "Announced acquisition of...".

DM HOOK EXTRACTION (apply to every [DM-SOCIAL] result):
- Contains person's name + company + recent activity → add/update decision_maker_chain entry with dm_hooks[]
- Minimum 1 hook per DM if [DM-SOCIAL] content found. Maximum 3 (best only).
- No [DM-SOCIAL] found → dm_hooks: ["no recent social activity found"]

19. [PROPTECH-PAIN] Resident reviews mentioning hardware failures or security gaps → map each complaint to a product category and add to pain_signals[]:
  - "gate broken/stuck/won't open/won't close" → pain about gate operators; severity="high" if recurring
  - "fob doesn't work", "key fob stopped" → access control failure; may mean system is end-of-life
  - "intercom broken/doesn't work" → intercom replacement opportunity
  - "no cameras", "camera not working" → camera system gap or failure
  - "package stolen", "packages stolen" → package management solution opportunity
  - "water damage", "flooding", "pipe burst", "water leak" → water sensor + leak detection opportunity
  - "parking chaos", "unauthorized vehicles" → parking/LPR management opportunity
  - "break-in", "someone got in", "unauthorized access" → access control urgency; severity="high"
  - Use these to populate proptech.displacement_targets[] and to select the email angle
  - CRITICAL: a [PROPTECH-PAIN] result with 3+ distinct complaints about the same system = severity="high", urgency="critical" on the profile

20. [ACQUISITION] Recent property sale, ownership transfer, or "under new management" signal:
  - Extract: approximate sale date, buyer entity, sale price if available
  - Add to ownership.acquisition_year and ownership.capex_signal
  - Properties acquired in the last 6–18 months: set profile.urgency="high" — new owners renegotiate vendor relationships
  - Properties acquired 18–36 months ago: set profile.urgency="medium" — still in capex deployment window
  - Add to pain_signals: source="ACQUISITION", signal_type="ownership_change", quote="[acquired/sold description from source]"
  - Email angle for new acquisitions: "Your predecessor's vendor contracts don't transfer with the deed — now is the window to set your own tech standard before leases lock in the next cycle."

21. [TECH-STACK] PMS and incumbent proptech vendor detection:
  - Yardi / RealPage / Entrata / AppFolio / MRI → update proptech stack; note integration opportunities
  - SmartRent / Latch → direct GateCard competitor; use competitive displacement angle
  - ButterflyMX → intercom incumbent; flag for intercom displacement pitch
  - Verkada / Avigilon / Milestone → camera incumbent
  - Salto / Openpath / HID → access control incumbent
  - "now leasing" / "grand opening" / "newly renovated" → lease-up signal; set urgency="high" (open capex window)
  - Add all detected vendors to proptech.access_control[], proptech.intercoms[], proptech.cameras[] as appropriate
  - Add to proptech.displacement_targets[] anything GateGuard can replace or integrate with

22. [UCC-FILING] UCC-1 financing statements filed by ISPs against property owners:
  - ISP = "secured party"; property owner = "debtor"; filing date = EXACT deal start date
  - Extract: ISP name, debtor entity name (= property owner), filing date, filing state
  - EXPIRY CALC: filing date year + 8 years (MDU standard) = expiry estimate. Output: "~[year] (est. from UCC-1 filing [date] + 8yr MDU term)"
  - D&B DUNS number: often appears in debtor description field of UCC record — extract and put in ownership.dnb_duns
  - Add UCC-1 evidence to bulk_agreements[] with confidence="high" — this is a legal filing, not marketing material
  - Filing state tells you the governing law jurisdiction for the contract
  - Always populate source_url with the UCC filing URL and source_snippet with the key debtor/secured party line from the filing.

23. [DNB-LOOKUP] OpenCorporates / D&B / Bizapedia / Cortera entity records:
  - Extract: legal entity name, state of formation, registered agent, parent company chain
  - D&B DUNS number: if present, populate ownership.dnb_duns AND relevant decision_maker_chain entries
  - Parent chain (LLC → LP → PE fund) reveals actual capex decision maker tier
  - Entity formation date: recently formed entity = new ownership signal → set profile.urgency="high"
  - Principal address geography: out-of-market investor (NYC address on Phoenix property) = asset manager controls the check → prioritize asset_manager in decision_maker_chain

WAYBACK MACHINE CDX DATA (if provided above):
  - firstSeen date on an ISP portfolio page = approximate deal launch date
  - EXPIRY CALC: firstSeen year + 8 years = estimated expiry (same confidence level as city permit method)
  - Multiple providers with first-crawl dates within 6 months of each other → portfolio-wide rollout
  - Treat with confidence="medium-high" (page publish date ≈ deal date; contract signing may be 6–12 months earlier)
  - Output format: expiry_estimate: "~[year] (est. from Wayback first-crawl [date] + 8yr typical MDU term)"

SEC EDGAR FILING DATA (if provided above):
  - [SEC-EDGAR] hit = public REIT or management company disclosed this bulk telecom agreement in SEC filing
  - The entity_name IS the REIT/company that owns or manages the property — this identifies the ownership chain
  - 10-K/10-Q hits: look in "Commitments and Contingencies" or "Lease Agreements" for ISP name + contract term + annual cost
  - 8-K hits: the EX-10 exhibit attached to the 8-K is often the ACTUAL EXECUTED CONTRACT — if URL available, treat as contract-pdf confidence level
  - Entity name + filing date → use entity investor relations page to find asset manager / management team names
  - Treat as confidence="high" for ISP name and approximate deal timing
  - REIT management team: the people named in 10-K "Management" section or Bisnow deal coverage are the asset managers and decision makers — add them to decision_maker_chain
  - COMBINED: Wayback CDX + SEC-EDGAR corroborating same ISP + same date range → upgrade to confidence="confirmed"

If NO web evidence found above → bulk_agreements = [] (never infer from market patterns alone)`
    })()

    await Promise.allSettled([fccPromise, oppPromise, tavilyPromise, mduProviderPromise, edgarPromise, priorFindingsPromise])

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

ARIA SCOPE — INTELLIGENCE COLLECTION ONLY (READ FIRST):
ARIA is a DATA COLLECTION and CROSS-REFERENCING engine. ARIA does NOT write marketing emails, campaign copy, subject lines, or email body text. That is SCOUT's function.
ARIA's output: structured property intelligence + clean contact data with top email format + scout_brief handoff packet.
For each contact: provide email (best guess address) + top_email_format (format + confidence %). No email body copy.

TARGETING LOGIC:
- Always return exactly 1 prospect regardless of query type
- Specific property/address → use that property
- General area/company → pick the best single target

BREVITY RULES (critical for performance):
- pain_signals: exactly 3 items
- Pain signal quote: under 80 chars, no line breaks
- scout_brief.key_data_points: exactly 3–5 items, each under 120 chars, each specific + verifiable

QUALITY STANDARDS:
- Property names should sound like real Atlanta/Dallas/Phoenix/Denver communities (e.g. "The Preserve at Sandy Springs", "Avalon Midtown", "Reserve at Legacy Park")
- Pain signal quotes must sound like real residents wrote them — gritty, specific, first person
- Buy scores: realistic range 6.5–9.2
- scout_brief.key_data_points must be specific + verifiable data points, not vague descriptions
- ARIA collects intelligence. SCOUT writes emails. Never generate email subject lines or body copy.

DECISION MAKER HIERARCHY (critical — target the right person):
GateGuard sells access control capex. Decisions are made by ASSET MANAGERS and OWNERS, not property managers.
The correct decision maker chain from most to least powerful:
1. OWNER / PE FIRM — The investment entity that owns the asset. Controls ultimate capex approval. Title at the owner entity: "Managing Partner", "Principal", "Chief Investment Officer", "General Partner". Set role_type="owner".
2. ASSET MANAGER — The person at the investment firm/owner who controls capex budget day-to-day. Title: "Asset Manager", "VP Asset Management", "Director of Asset Management", "Portfolio Manager". Set role_type="asset_manager". This is the FIRST EMAIL TARGET.
3. REGIONAL MANAGER / VP — Oversees 5–20+ properties for the management company. Can approve vendor changes and flag to owners. Title: "Regional Manager", "Regional VP", "Vice President of Operations", "Director of Properties". Set role_type="regional_manager".

DECISION MAKER RESEARCH RULES — ALWAYS POPULATE ALL 3 TIERS:
- decision_maker_chain MUST include entries for all 3 tiers: owner, asset_manager, regional_manager. If you can't confirm a real name for a tier, use "Unknown [Title] — [Company]" as the name but still include the tier.
- For the owner tier: check the property's ownership entity from county records or OM. PE firms (Blackstone, Starwood, KKR, JBG Smith, Morgan Properties) have asset managers whose names appear in Bisnow and LinkedIn.
- For the asset manager tier: this is who sends the wire and signs the contract. Their name often appears in SEC filings, Bisnow deal announcements, and REIT investor presentations.
- For the regional manager tier: look for LinkedIn profiles with "Regional Manager" or "Regional VP" + the management company name + the city/state.
- Management companies: Greystar (regional VPs on LinkedIn), Equity Residential (asset management team), MAA, AvalonBay, Aimco, Cortland, Lincoln Property Company, RPM Living, Bozzuto.
- email field: asset managers = firstname.lastname@[ownerfirm].com; regional managers = firstname.lastname@[managementco].com
- email_confidence: 0.95 = confirmed LinkedIn/company site, 0.70 = format-inferred, 0.50 = guessed

DECISION MAKER PERSONALIZATION — dm_hooks[] (this is what moves reply rates):
The dm_hooks[] array on each decision_maker_chain entry powers the personalized email variants.
Extract hooks from [DM-SOCIAL] web results — these are recent LinkedIn posts, Bisnow conference coverage, articles, and announcements by the specific individual.
- A hook must be SPECIFIC and RECENT (last 12 months): "Posted in March 2025 about using smart access to reduce insurance premiums" beats "works in multifamily real estate"
- Hook format always starts with a verb: "Posted about...", "Spoke at NMHC on...", "Announced acquisition of...", "Shared article on...", "LinkedIn: excited to close..."
- The BEST hook is something that proves you read their content — not just that they work at the company
- Include 1–3 hooks per contact. Quality over quantity.
- If no [DM-SOCIAL] data → dm_hooks: ["no recent social activity found — use general company context"]

DM HOOKS — FOR SCOUT HANDOFF (ARIA collects, SCOUT uses):
dm_hooks[] on each decision_maker_chain entry are for SCOUT to use in personalized outreach.
ARIA's job: extract specific, verifiable, recent (last 12 months) hooks from [DM-SOCIAL] results.
Format always starts with a verb: "Posted about...", "Spoke at NMHC on...", "Announced acquisition of...", "Shared article on..."
A hook must prove you read their actual content — not just that they work at the company.
Include these same hooks in scout_brief.key_data_points if they are strong personalization signals.

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

PROPTECH HARDWARE PAIN → PRODUCT MAPPING (use [PROPTECH-PAIN] signals to lead with the right product):
- Gate complaints (broken, stuck, won't open) → Gate operator replacement; lead with liability + resident retention
- Fob/key failure, access control complaints → Access control modernization; lead with mobile credentials + cost of rekeying
- Intercom broken / no video entry → Intercom/video entry replacement; lead with ButterflyMX displacement if detected
- Package theft → Package management solution; lead with resident trust + NOI from amenity fees
- Water damage / flooding / pipe burst → Water sensor deployment; lead with insurance premium reduction + liability
- No cameras / camera failures → Camera system; lead with liability reduction + insurance discount
- Break-ins / unauthorized access → Access control urgency + camera; lead with resident safety + insurance
- Parking chaos / unauthorized vehicles → LPR / parking management; lead with NOI from enforcement fees

ACQUISITION TIMING RULES (from [ACQUISITION] signals):
- Acquired <18 months ago → highest priority; owner is still in "set the standard" mode; lead with: "Before your first lease cycle locks in, set a tech standard that differentiates you from day 1."
- Acquired 18–36 months ago → medium priority; capex is deploying; lead with: "Most value-add operators tackle tech in year 2 — that window is open now."
- Property listed for sale / recent OM found → pre-sale seller wants NOI improvement; lead with: "A managed access platform adds $X/unit to NOI and shows in your cap rate at sale."

TECH STACK RULES (from [TECH-STACK] signals):
- SmartRent or Latch detected → this is a competitive account; acknowledge the incumbent and pitch GateCard's cost and integration advantage
- ButterflyMX detected → they have video entry but may not have access control integration; pitch the unified stack
- Yardi/RealPage/Entrata detected → enterprise operator; lead with certified integration + compliance reporting
- "now leasing" / lease-up detected → open capex window; tech is being selected NOW; urgency="critical"
- No tech stack detected → greenfield opportunity; lead with full GateGuard stack from scratch

CONTRACT AUDIT WINDOW — MOST VALUABLE OUTREACH TRIGGER:
When [CONTRACT-PDF], [UCC-FILING], [COUNTY-DEED], [OFFERING-MEMO], or [ISP-PRESS-RELEASE] evidence puts a bulk telecom contract expiry within 24 months:
- The property manager is actively in "contract review mode" — they are re-evaluating EVERY service contract, not just internet
- This is when they evaluate gates, cameras, access control, intercoms, smart locks — the full low-voltage stack
- This window closes the moment they sign the renewal. Strike before they sign.
- Email angle: "When a property is auditing its broadband contract, the gates, cameras, and access control are on the same checklist. Our install team is already in your area — 15 minutes to walk the property?"
- If expiry < 6 months → urgency="critical", subject line should create urgency: "Your [ISP] contract window is closing..."
- If expiry 6–18 months → urgency="high", subject line focuses on evaluation: "Most operators don't start the RFP until it's too late..."
- If expiry 18–24 months → urgency="medium", subject line focuses on planning: "Q3 2026 — when does your [ISP] contract come up?"

OUTREACH ANGLE SELECTION (for scout_brief.outreach_angle):
- [CONTRACT-PDF/UCC-FILING/COUNTY-DEED] + expiry within 24mo → outreach_angle="contract_window"
- [PROPTECH-PAIN] with 3+ complaints on same system → outreach_angle="proptech_pain"
- [ACQUISITION] recent ownership change → outreach_angle="acquisition"
- SmartRent/Latch/ButterflyMX detected → outreach_angle="tech_displacement"
- sara_signals=true → outreach_angle="sara_bridge"
- FCC fiber available but property on cable-only → outreach_angle="upgrade_path"
- "now leasing" / lease-up detected → outreach_angle="lease_up"
- Default → outreach_angle="general"
Set scout_brief.contract_window_urgency based on expiry timing:
  - <6 months → "critical" | 6–18 months → "high" | 18–24 months → "medium" | >24 months → "low" | no contract data → "none"`,

      messages: [{
        role: 'user',
        content: `ARIA research query: "${query.trim()}"
${existingNamesBlock}${priorFindings}${cachedDetectionsBlock}${mduProviderContextBlock}${fccContextBlock}${waybackBlock}${edgarBlock}${tavilyContextBlock}
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

    // ── Persist contract findings to aria_contract_findings (survives search deletion) ──
    void persistContractFindings(data.prospects ?? [], savedSearchId)

    return NextResponse.json({ ...data, savedSearchId, fccVerified: fccProvidersForUI.length > 0, webIntelligence: tavilyContextBlock.length > 100 })

  } catch (err: any) {
    console.error('[aria/research]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
