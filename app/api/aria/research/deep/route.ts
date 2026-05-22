/**
 * POST /api/aria/research/deep
 *
 * ARIA Deep Intel — Tavily-powered property-specific connectivity research.
 * Runs after the initial ARIA result returns a known property name/address.
 *
 * Runs 4 Tavily searches in parallel targeting the specific property:
 *   1. ISP availability + reviews at this property
 *   2. Bulk/included internet signals (listing sites)
 *   3. Management company MDU deal patterns
 *   4. Resident forum posts about internet at this property
 *
 * Claude Haiku synthesizes all excerpts into structured output with citations.
 *
 * Cost: 4 Tavily basic credits (~$0.032 at pay-as-you-go) + ~$0.001 Claude Haiku
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ─── Tavily helper ────────────────────────────────────────────────────────

interface TavilyResult {
  title: string
  url: string
  content: string
  score: number
}

interface TavilyResponse {
  results: TavilyResult[]
  answer?: string
}

async function tavilySearch(query: string, maxResults = 5): Promise<TavilyResult[]> {
  if (!process.env.TAVILY_API_KEY) return []
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        search_depth: 'basic',
        max_results: maxResults,
        include_answer: false,
        include_raw_content: false,
        include_images: false,
      }),
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return []
    const data: TavilyResponse = await res.json()
    return data.results ?? []
  } catch {
    return []
  }
}

// ─── Deep intel synthesis tool ────────────────────────────────────────────

const deepIntelTool: Anthropic.Tool = {
  name: 'aria_deep_intel_result',
  description: 'Return the structured deep connectivity, proptech, and ownership intelligence for this property.',
  input_schema: {
    type: 'object' as const,
    required: ['isp_providers', 'video_providers', 'bulk_agreements', 'key_finding', 'confidence', 'proptech'],
    properties: {
      isp_providers: {
        type: 'array',
        items: { type: 'string' },
        description: 'ISPs confirmed or strongly indicated to serve this specific property — include local/regional ISPs found in sources',
      },
      video_providers: {
        type: 'array',
        items: { type: 'string' },
        description: 'Video/TV providers confirmed or strongly indicated at this property',
      },
      bulk_agreements: {
        type: 'array',
        description: 'Bulk/exclusive/preferred ISP or video agreements. Return empty array [] if no property-specific evidence found.',
        items: {
          type: 'object',
          required: ['provider', 'service_type', 'agreement_type', 'expiry_estimate', 'confidence', 'evidence'],
          properties: {
            provider:        { type: 'string', description: 'Exact ISP/provider name from source — include local/regional ISPs verbatim' },
            service_type:    { type: 'string', enum: ['internet', 'video', 'bundled'] },
            agreement_type:  { type: 'string', enum: ['exclusive', 'bulk', 'preferred', 'unknown'] },
            expiry_estimate: { type: 'string' },
            confidence:      { type: 'string', enum: ['high', 'medium', 'low'], description: 'high=explicit text evidence, medium=implied, low=inferred from patterns only' },
            evidence:        { type: 'string', description: 'Exact quote from source text (under 100 chars) — empty string means confidence must be low' },
          },
        },
      },
      key_finding: {
        type: 'string',
        description: '1-2 sentence sales insight: WHO to call (asset manager/owner if found) and WHY NOW (bulk deal expiry, tech refresh, recent acquisition)',
      },
      confidence: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: 'Overall confidence in these findings based on source quality and specificity',
      },
      atlas_opportunity: {
        type: 'boolean',
        description: 'True if DirecTV/AT&T video agreement detected or strongly implied — ATLAS bundle pitch applicable',
      },
      ownership: {
        type: 'object',
        description: 'Who actually owns and controls capex for this property',
        properties: {
          owner_entity:    { type: 'string', description: 'Legal owner / investment firm name' },
          owner_type:      { type: 'string', enum: ['private_equity', 'reit', 'family_office', 'individual', 'management_company_owned', 'unknown'] },
          portfolio_size:  { type: 'string', description: 'Approx number of units this owner controls if found in sources' },
          acquisition_year: { type: 'string', description: 'Year owner acquired this property if mentioned, else "unknown"' },
          capex_signal:    { type: 'string', description: 'Evidence of recent/planned capital investment (renovation, refinancing, acquisition)' },
          asset_manager:   {
            type: 'object',
            description: 'The asset manager or portfolio manager at the ownership entity who controls capex approval',
            properties: {
              name:          { type: 'string' },
              title:         { type: 'string' },
              company:       { type: 'string' },
              linkedin_slug: { type: 'string' },
              email:         { type: 'string' },
              email_confidence: { type: 'number' },
            },
          },
        },
      },
      proptech: {
        type: 'object',
        properties: {
          gate_operators:     { type: 'array', items: { type: 'string' } },
          access_control:     { type: 'array', items: { type: 'string' } },
          intercoms:          { type: 'array', items: { type: 'string' } },
          cameras:            { type: 'array', items: { type: 'string' } },
          smart_locks:        { type: 'array', items: { type: 'string' } },
          resident_apps:      { type: 'array', items: { type: 'string' } },
          tech_generation:    { type: 'string', enum: ['legacy','modern','hybrid'] },
          sara_signals:       { type: 'boolean' },
          replacement_window: { type: 'string' },
          displacement_targets: { type: 'array', items: { type: 'string' } },
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

    if (!process.env.TAVILY_API_KEY) {
      return NextResponse.json({ error: 'TAVILY_API_KEY not configured' }, { status: 503 })
    }

    const { property_name, address, management_company, city, state } = await req.json()
    if (!property_name) return NextResponse.json({ error: 'property_name required' }, { status: 400 })

    const location = [city, state].filter(Boolean).join(', ') || address || ''
    const mgmt = management_company || ''

    // ── 10 targeted Tavily searches in parallel ─────────────────────────
    const [ispResults, bulkResults, mgmtResults, redditResults, gateResults, proptechResults, residentTechResults, mgmtProptechResults, localIspResults, ownershipResults] = await Promise.all([
      // 1. ISP service at this property — general availability + resident experience
      tavilySearch(`"${property_name}" ${location} internet provider ISP service`),

      // 2. Bulk/included internet signals — apartment listing sites are goldmines for this
      // Include local/regional ISP signals alongside national names
      tavilySearch(`"${property_name}" "internet included" OR "bulk internet" OR "fiber included" OR "Comcast included" OR "Spectrum included" OR "AT&T included" OR "preferred provider" OR "gigastream" OR "sonic" OR "hotwire" OR "vyve" OR "local internet"`),

      // 3. Management company MDU patterns — large mgmt cos often have portfolio-wide deals
      mgmt ? tavilySearch(`"${mgmt}" MDU internet bulk agreement exclusive Comcast Spectrum "AT&T" OR "local ISP" OR "regional fiber"`) : Promise.resolve([]),

      // 4. Resident forum posts — Reddit, apartment review sites, local FB groups
      tavilySearch(`"${property_name}" ${location} internet ISP "locked in" OR "only option" OR "bulk deal" OR "included with rent" OR "can only use" OR "building internet"`),

      // 5. Current gate/access/intercom tech at this property
      tavilySearch(`"${property_name}" ${location} gate intercom "access control" cameras security technology vendor`),

      // 6. Specific proptech vendor mentions
      tavilySearch(`"${property_name}" OR "${mgmt}" ButterflyMX OR Brivo OR LiftMaster OR DoorKing OR SmartRent OR Latch OR "Openpath" OR Verkada OR "Eagle Eye"`),

      // 7. Resident tech complaints — goldmine for identifying what's installed and broken
      tavilySearch(`"${property_name}" "gate broken" OR "gate stuck" OR "intercom" OR "key fob" OR "access" OR "package" OR "smart lock" OR "cameras not working"`),

      // 8. Management company proptech standards
      mgmt ? tavilySearch(`"${mgmt}" multifamily proptech "access control" OR "gate operator" OR "smart home" preferred vendor standard`) : Promise.resolve([]),

      // 9. LOCAL/REGIONAL ISP bulk deal detection — specifically targets non-national ISPs
      // that frequently have MDU deals but don't appear in national carrier searches
      tavilySearch(`"${property_name}" ${location} "bulk internet" OR "internet included" OR "fiber included" site:apartmentlist.com OR site:apartments.com OR site:zillow.com OR site:rent.com`),

      // 10. Ownership + asset management — who actually controls capex decisions
      tavilySearch(`"${property_name}" ${location} "asset manager" OR "portfolio manager" OR "ownership" OR "acquired" OR "owner" OR "investment" multifamily`),
    ])

    // ── Deduplicate and rank sources ────────────────────────────────────
    const allResults = [...ispResults, ...bulkResults, ...mgmtResults, ...redditResults, ...gateResults, ...proptechResults, ...residentTechResults, ...mgmtProptechResults, ...localIspResults, ...ownershipResults]
    const seenUrls = new Set<string>()
    const uniqueResults = allResults
      .filter(r => {
        if (seenUrls.has(r.url)) return false
        seenUrls.add(r.url)
        return r.score > 0.3 // filter low-confidence results
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 12) // top 12 results across all 4 searches

    if (uniqueResults.length === 0) {
      return NextResponse.json({
        isp_providers: [],
        video_providers: [],
        bulk_agreements: [],
        key_finding: 'No property-specific connectivity data found via web research.',
        confidence: 'low',
        atlas_opportunity: false,
        proptech: { gate_operators: [], access_control: [], intercoms: [], cameras: [], smart_locks: [], resident_apps: [], tech_generation: 'legacy', sara_signals: false, replacement_window: null, displacement_targets: [] },
        sources: [],
      })
    }

    // ── Format excerpts for Claude ──────────────────────────────────────
    const excerptBlock = uniqueResults.map((r, i) =>
      `[Source ${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content.slice(0, 400)}`
    ).join('\n\n---\n\n')

    // ── Claude synthesizes all excerpts ─────────────────────────────────
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      tools: [deepIntelTool],
      tool_choice: { type: 'tool', name: 'aria_deep_intel_result' },
      system: `You are ARIA's deep connectivity, proptech, and ownership intelligence module. Your job is to extract ISP, MDU deal, property technology stack, and ownership/asset manager intelligence from web search excerpts about a specific multifamily property.

BULK AGREEMENT EXTRACTION — CRITICAL ACCURACY RULES:
⚠ DO NOT guess the bulk provider based on which ISP is most well-known or largest in the area.
⚠ Local/regional ISPs (e.g. Gigastream, Sonic, Hotwire, WideOpenWest, Vyve, IgLou, Blue Ridge, Ting, Consolidated, TDS) frequently have MDU deals with specific properties and may NOT be the area's dominant ISP.
⚠ If a source mentions a small or unfamiliar ISP name as the building's provider, TRUST IT over inferring a national carrier.

Confidence rules for bulk_agreements[]:
- confidence="high" ONLY when source TEXT explicitly states: "internet included", "bulk deal", "exclusive provider", "building's internet provider", "can only use [X]", "fiber included in rent", or similar. This must appear in the actual source text, not your inference.
- confidence="medium" when source implies it: "everyone here uses [X]", "the building deal with [X]", "residents are forced to use [X]", "property has a contract with [X]"
- confidence="low" when inferring from market patterns alone (cable-only area, property vintage, etc.) with NO property-specific evidence
- If you cannot find property-specific bulk agreement evidence → return bulk_agreements = [] (empty array). Empty is correct — do NOT fabricate.
- evidence field: copy the exact text phrase (under 100 chars) that justifies this finding — if you can't quote it, set confidence="low"

ISP PROVIDER EXTRACTION:
- Report ISPs actually mentioned in sources for this property — not all ISPs in the market
- If a source from an apartment listing site says "High-speed internet by Gigastream" — that is the ISP, even if you don't have training data on Gigastream
- Include regional/local ISPs that appear in sources regardless of their national profile

PROPTECH EXTRACTION (from web sources):
- Gate operators: job postings, reviews mentioning specific brands, permit descriptions
- Access control/intercoms: amenity pages, resident reviews mentioning apps by name, job listings
- Resident apps: App Store/Play Store reviews for SmartRent, Latch, ButterflyMX often name specific properties
- sara_signals: true if DoorKing gates + DIRECTV/AT&T + no modern access control — classic SARA Plus dealer property profile
- evidence field: quote the specific text supporting each finding

OWNERSHIP & DECISION MAKER EXTRACTION:
- Look for the actual owner entity (investment firm, REIT, family office) vs the management company
- Asset managers at the ownership firm are the real capex decision makers
- Extract: owner company name, owner type (private equity, REIT, family office, etc.), when they acquired the property
- If sources mention refinancing, renovation, new acquisition, or capital improvement budget — flag as capex_signal
- key_finding: write as a sales insight for a GateGuard rep. Lead with WHO to call (asset manager name/company) and WHY NOW (bulk deal expiry, recent acquisition, aging tech)

atlas_opportunity: true if DirecTV, AT&T U-verse, or "AT&T TV" mentioned as the building's video provider`,

      messages: [{
        role: 'user',
        content: `Property: ${property_name}
Location: ${location}
Management Company: ${mgmt || 'unknown'}

Web research excerpts (10 searches — ISP availability, bulk deals, local/regional ISPs, proptech, ownership/asset management):
${excerptBlock}

Extract all intelligence from these sources and call the aria_deep_intel_result tool.

REMINDER: If no bulk agreement is confirmed by source text, return bulk_agreements = []. Empty is correct — do not infer from market patterns alone. Prioritize local/regional ISP names found in listing sites or reviews over national carrier assumptions.`,
      }],
    })

    const toolBlock = message.content.find(b => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined
    if (!toolBlock) throw new Error('No synthesis result from Claude')

    const intel = toolBlock.input as {
      isp_providers: string[]
      video_providers: string[]
      bulk_agreements: any[]
      key_finding: string
      confidence: string
      atlas_opportunity?: boolean
      proptech?: {
        gate_operators?: string[]
        access_control?: string[]
        intercoms?: string[]
        cameras?: string[]
        smart_locks?: string[]
        resident_apps?: string[]
        tech_generation?: string
        sara_signals?: boolean
        replacement_window?: string
        displacement_targets?: string[]
      }
    }

    // Attach source links to response so UI can show them
    const sources = uniqueResults.slice(0, 6).map(r => ({
      title: r.title,
      url: r.url,
      excerpt: r.content.slice(0, 200),
      score: r.score,
    }))

    return NextResponse.json({ ...intel, sources })

  } catch (err: any) {
    console.error('[aria/research/deep]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
