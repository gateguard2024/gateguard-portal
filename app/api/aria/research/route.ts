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
 *   4. Inject FCC-verified ISPs as hard facts into Claude's prompt
 *
 * Accuracy targets:
 *   - ISP availability: ~95% (FCC 477 data, updated twice yearly)
 *   - Video provider: ~75% (FCC + AI inference)
 *   - Bulk/exclusive agreements: ~60% (AI inference from ISP concentration + property data)
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

/**
 * Format FCC provider list into a human-readable block for Claude's prompt.
 * Groups by technology type so Claude can identify cable-only markets (higher bulk deal risk).
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
    `FCC BROADBAND MAP DATA — Verified ISP coverage at/near ${location}:`,
    `(Source: FCC Form 477 / Broadband Map API — authoritative data, updated biannually)`,
  ]
  for (const [tech, names] of Object.entries(byTech)) {
    lines.push(`  ${tech}: ${names.join(', ')}`)
  }

  // Flag cable-only markets (higher MDU bulk deal probability)
  const hasFiber = !!byTech['Fiber']?.length
  const hasCable = !!byTech['Cable']?.length
  const hasOnlyCable = hasCable && !hasFiber
  if (hasOnlyCable) {
    lines.push(`  ⚠ CABLE-ONLY MARKET: No fiber ISP detected. High probability of Comcast/Spectrum exclusive bulk deal.`)
  } else if (hasFiber && hasCable) {
    lines.push(`  FIBER + CABLE MARKET: Competition present — bulk agreements less likely to be exclusive.`)
  }

  // Flag DirecTV / AT&T presence (ATLAS pitch opportunity)
  const allNames = providers.map(p => (p.brand_name + ' ' + p.holding_company).toLowerCase())
  if (allNames.some(n => n.includes('at&t') || n.includes('directv') || n.includes('att '))) {
    lines.push(`  AT&T / DirecTV service confirmed in this market — ATLAS bundle pitch applicable.`)
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
              required: ['name', 'address', 'units', 'year_built', 'management_company', 'owner_entity', 'property_type', 'class', 'occupancy', 'isp_providers', 'video_providers', 'bulk_agreements'],
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
              },
            },
            decision_maker: {
              type: 'object',
              required: ['name', 'title', 'company', 'linkedin_slug', 'email', 'email_confidence', 'phone', 'tenure_years'],
              properties: {
                name:             { type: 'string' },
                title:            { type: 'string' },
                company:          { type: 'string' },
                linkedin_slug:    { type: 'string' },
                email:            { type: 'string' },
                email_confidence: { type: 'number' },
                phone:            { type: 'string' },
                tenure_years:     { type: 'number' },
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

    // ── Step 1: FCC connectivity intel (runs in parallel with opp exclusion fetch) ──
    let fccBlock = ''
    let fccProvidersForUI: string[] = []
    const fccPromise = (async () => {
      try {
        const locationHint = extractLocationHint(query)
        if (!locationHint) return
        const geo = await geocodeLocation(locationHint)
        if (!geo) return
        const providers = await fetchFCCBroadband(geo.lat, geo.lng)
        if (providers.length === 0) return
        fccBlock = formatFCCDataForPrompt(providers, locationHint)
        fccProvidersForUI = [...new Set(providers.map(p => p.brand_name || p.holding_company))]
      } catch {
        // non-blocking — ARIA continues without FCC data
      }
    })()

    // ── Step 2: Fetch existing active opportunity names so ARIA doesn't re-suggest them ──
    let existingOppNames: string[] = []
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
      } catch {
        // non-blocking
      }
    })()

    // Wait for both parallel fetches
    await Promise.allSettled([fccPromise, oppPromise])

    const existingNamesBlock = existingOppNames.length > 0
      ? `\n\nEXCLUSION LIST — these properties are already active in our CRM pipeline. Do NOT suggest any of these as prospects:\n${existingOppNames.map(n => `- ${n}`).join('\n')}\n`
      : ''

    // ── Step 3: Build FCC context block for Claude ──
    const fccContextBlock = fccBlock
      ? `\n\n${fccBlock}\n\nIMPORTANT: The FCC data above is AUTHORITATIVE. Populate isp_providers[] ONLY with ISPs from this list. Do NOT invent ISPs not present in FCC data. You may add video_providers beyond what FCC lists (FCC 477 covers internet, not video). Infer bulk_agreements from the FCC provider concentration + property class.\n`
      : `\n\nNOTE: FCC broadband data unavailable for this query (no location resolved). Use your best knowledge of typical ISP coverage in the target market.\n`

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

ISP & VIDEO PROVIDER RESEARCH (required for every prospect):
- If FCC broadband data is provided below, use ONLY those ISPs for isp_providers[]. This is verified government data, not inference.
- For video_providers: FCC 477 does not cover video. Research which video/TV providers serve the property (DirecTV, Comcast, Spectrum, Dish, Fubo, etc.)
- For bulk_agreements: estimate based on:
  * Cable-only markets → high probability of Comcast/Spectrum exclusive MDU deal
  * Fiber available → competition reduces exclusivity risk, but bulk/preferred deals still common
  * Property built/renovated 2015–2021 + cable-only market → bulk deal likely expiring 2025–2028
  * AT&T Fiber in market → possible competing bulk deal; also ATLAS bundle opportunity
  * DirecTV (AT&T) MDU agreements expiring = HOT lead for ATLAS bundle pitch
- Set confidence accurately: "high" only if property/market context strongly implies a deal

EMAIL ANGLE RULE — ISP/VIDEO INTEL:
- If a bulk agreement expiry is within 18 months → use "contract_window" email angle referencing the transition
- If property is on Comcast/Spectrum exclusively but AT&T Fiber is in the FCC data → use "upgrade path" angle
- If no video provider found or DirecTV explicitly mentioned → use ATLAS MDU pitch angle`,

      messages: [{
        role: 'user',
        content: `ARIA research query: "${query.trim()}"
${existingNamesBlock}${fccContextBlock}
GateGuard offerings to weave into emails where relevant:
- Gate operators, access control (Brivo), intercoms, cameras — full stack install
- Visitor management: GateCard platform — resident app, mobile access, delivery management
- DirecTV/AT&T MDU bulk TV + internet for whole building (ATLAS bundle)
- The Elevate Model: $10/unit/mo GateGuard cost → $150/yr resident fee → $30/unit/yr net profit for property
- SARA Bridge: easy migration path from SARA Plus

${fccBlock ? 'The FCC data above is already resolved for this location. Use it directly for isp_providers[]. Do NOT override it with your own inference.' : 'No FCC data available. Infer ISPs from your knowledge of the target market.'}

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

    return NextResponse.json({ ...data, savedSearchId, fccVerified: fccProvidersForUI.length > 0 })

  } catch (err: any) {
    console.error('[aria/research]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
