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
  description: 'Return the structured deep connectivity intelligence for this property.',
  input_schema: {
    type: 'object' as const,
    required: ['isp_providers', 'video_providers', 'bulk_agreements', 'key_finding', 'confidence'],
    properties: {
      isp_providers: {
        type: 'array',
        items: { type: 'string' },
        description: 'ISPs confirmed or strongly indicated to serve this specific property',
      },
      video_providers: {
        type: 'array',
        items: { type: 'string' },
        description: 'Video/TV providers confirmed or strongly indicated at this property',
      },
      bulk_agreements: {
        type: 'array',
        items: {
          type: 'object',
          required: ['provider', 'service_type', 'agreement_type', 'expiry_estimate', 'confidence', 'evidence'],
          properties: {
            provider:        { type: 'string' },
            service_type:    { type: 'string', enum: ['internet', 'video', 'bundled'] },
            agreement_type:  { type: 'string', enum: ['exclusive', 'bulk', 'preferred', 'unknown'] },
            expiry_estimate: { type: 'string' },
            confidence:      { type: 'string', enum: ['high', 'medium', 'low'] },
            evidence:        { type: 'string', description: 'What specific source/excerpt supports this finding' },
          },
        },
      },
      key_finding: {
        type: 'string',
        description: '1-2 sentence summary of the most important connectivity intel found — the sales hook',
      },
      confidence: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: 'Overall confidence in these findings based on source quality',
      },
      atlas_opportunity: {
        type: 'boolean',
        description: 'True if DirecTV/AT&T video agreement detected or strongly implied — ATLAS bundle pitch applicable',
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

    // ── 4 targeted Tavily searches in parallel ──────────────────────────
    const [ispResults, bulkResults, mgmtResults, redditResults] = await Promise.all([
      // 1. ISP service at this property — general availability + resident experience
      tavilySearch(`"${property_name}" ${location} internet provider ISP service`),

      // 2. Bulk/included internet signals — apartment listing sites are goldmines for this
      tavilySearch(`"${property_name}" internet included OR "bulk internet" OR "Comcast included" OR "Spectrum included" OR "AT&T included" OR "preferred provider"`),

      // 3. Management company MDU patterns — large mgmt cos often have portfolio-wide deals
      mgmt ? tavilySearch(`"${mgmt}" MDU internet bulk agreement exclusive Comcast Spectrum "AT&T"`) : Promise.resolve([]),

      // 4. Resident forum posts — Reddit, apartment review sites, local FB groups
      tavilySearch(`"${property_name}" ${location} internet cable ISP "locked in" OR "only option" OR "bulk deal" OR "included with rent"`),
    ])

    // ── Deduplicate and rank sources ────────────────────────────────────
    const allResults = [...ispResults, ...bulkResults, ...mgmtResults, ...redditResults]
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
      system: `You are ARIA's deep connectivity intelligence module. Your job is to extract ISP and MDU deal intelligence from web search excerpts about a specific multifamily property.

EXTRACTION RULES:
- Only report ISPs/providers that are CONFIRMED or STRONGLY implied by the source text
- For bulk_agreements: confidence="high" only if a source explicitly says "included with rent", "bulk deal", "exclusive", or names the provider as the building's preferred/only option
- confidence="medium" if a source implies it ("everyone here uses Comcast", "building deal with Spectrum")
- confidence="low" if it's inferential or based on management company patterns
- evidence field: quote the specific text that supports the finding (under 100 chars)
- atlas_opportunity: true if you see DirecTV, AT&T U-verse, or "AT&T TV" mentioned as the building's video provider — this is a hot ATLAS pitch signal
- key_finding: write this as a sales insight for a GateGuard rep, not a data summary`,

      messages: [{
        role: 'user',
        content: `Property: ${property_name}
Location: ${location}
Management Company: ${mgmt || 'unknown'}

Web research excerpts:
${excerptBlock}

Extract all connectivity intelligence from these sources and call the aria_deep_intel_result tool.`,
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
