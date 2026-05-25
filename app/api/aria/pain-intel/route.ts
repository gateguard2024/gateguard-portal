/**
 * POST /api/aria/pain-intel
 *
 * ARIA Pain Signal Mining — v1.1
 * Runs 6 targeted Tavily searches for a specific property, then uses
 * Claude Haiku to synthesize pain_score, service_score, lead_temperature,
 * pain_signals, service_signals, outreach_angle, and citations.
 *
 * Result is persisted to the `aria_research` table.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ── Tavily helper ────────────────────────────────────────────────────────────

interface TavilyResult {
  title: string
  url: string
  content: string
  score: number
}

async function tavilySearch(query: string, maxResults = 5): Promise<TavilyResult[]> {
  if (!process.env.TAVILY_API_KEY) return []
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
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
    const data = await res.json()
    return data.results ?? []
  } catch {
    return []
  }
}

// ── Claude tool schema ───────────────────────────────────────────────────────

const painIntelTool: Anthropic.Tool = {
  name: 'aria_pain_intel_result',
  description: 'Return structured pain signal intelligence for a multifamily property.',
  input_schema: {
    type: 'object' as const,
    required: ['pain_signals', 'service_signals', 'pain_score', 'service_score', 'lead_temperature', 'outreach_angle', 'citations'],
    properties: {
      pain_signals: {
        type: 'array',
        description: 'Evidence of gate/access/security problems, tenant complaints, aging infrastructure, permit issues.',
        items: { type: 'string' },
      },
      service_signals: {
        type: 'array',
        description: 'Evidence of existing DirecTV/cable/internet bulk deals, competitor installations, upgrade interest.',
        items: { type: 'string' },
      },
      pain_score: {
        type: 'number',
        description: '0-10. 0 = no pain signals found. 10 = clear evidence of urgent gate/security/access failures.',
      },
      service_score: {
        type: 'number',
        description: '0-10. 0 = no service signals found. 10 = clear bulk deal or DirecTV/AT&T service confirmed.',
      },
      lead_temperature: {
        type: 'string',
        enum: ['hot', 'warm', 'cold'],
        description: 'hot = pain_score 7-10, warm = 4-6, cold = 0-3.',
      },
      outreach_angle: {
        type: 'string',
        description: 'Best 1-sentence opening line for a GateGuard sales rep based on what was found. Reference the specific property name and a real finding.',
      },
      citations: {
        type: 'array',
        description: 'Up to 5 source citations for the most important signals found.',
        items: {
          type: 'object',
          required: ['signal', 'source'],
          properties: {
            signal: { type: 'string', description: 'The specific finding (under 120 chars).' },
            source: { type: 'string', description: 'Source URL or "No source found".' },
          },
        },
      },
    },
  },
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!process.env.TAVILY_API_KEY) {
      return NextResponse.json({ error: 'TAVILY_API_KEY not configured' }, { status: 503 })
    }

    const body = await req.json()
    const { property_name, property_address, city, state } = body

    if (!property_name) {
      return NextResponse.json({ error: 'property_name required' }, { status: 400 })
    }

    const loc = [city, state].filter(Boolean).join(', ') || property_address || ''

    // ── 6 parallel Tavily searches ───────────────────────────────────────
    const [
      gateReviews,
      serviceSignals,
      residentPain,
      managementIntel,
      oldPermits,
      upgradeInterest,
    ] = await Promise.all([
      // 1. Gate/access complaints in reviews
      tavilySearch(`"${property_name}" ${loc} gate broken access control reviews`),
      // 2. DirecTV/bulk cable/internet included
      tavilySearch(`"${property_name}" ${loc} DirecTV bulk cable internet included`),
      // 3. Resident pain — gate fob key access
      tavilySearch(`"${property_name}" ${loc} apartment reviews gate fob access key`),
      // 4. Management company MDU patterns
      tavilySearch(`"${property_name}" management company multifamily MDU`),
      // 5. Old permits = old gates
      tavilySearch(`${loc} multifamily gate permit 2019 2020 2021 2022`),
      // 6. Active upgrade interest
      tavilySearch(`"${property_name}" ${loc} access control upgrade security`),
    ])

    // Deduplicate and rank
    const seenUrls = new Set<string>()
    const allResults = [
      ...gateReviews, ...serviceSignals, ...residentPain,
      ...managementIntel, ...oldPermits, ...upgradeInterest,
    ]
      .filter(r => {
        if (!r.url || seenUrls.has(r.url)) return false
        seenUrls.add(r.url)
        return r.score > 0.2
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 15)

    if (allResults.length === 0) {
      const empty = {
        pain_signals: [],
        service_signals: [],
        pain_score: 0,
        service_score: 0,
        lead_temperature: 'cold' as const,
        outreach_angle: `Hi, I'm reaching out about ${property_name} — we work with multifamily properties in ${loc} on gate and access control systems.`,
        citations: [],
      }
      // Persist empty result (non-blocking)
      void persistResult(userId, body, empty)
      return NextResponse.json(empty)
    }

    const excerpts = allResults
      .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content.slice(0, 400)}`)
      .join('\n\n---\n\n')

    // ── Claude Haiku synthesis ───────────────────────────────────────────
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      tools: [painIntelTool],
      tool_choice: { type: 'tool', name: 'aria_pain_intel_result' },
      system: `You are ARIA's pain signal mining module for GateGuard, a multifamily access control company. 
Analyze web search results about a specific property and extract evidence of:
- Gate/door/access control failures or complaints (pain signals)
- Existing service providers, bulk deals, or upgrade interest (service signals)

Be specific and factual. Only report what is actually in the sources. 
Pain score rules: 7+ = multiple complaints or clear failures. 4-6 = some signals. 0-3 = no evidence.
lead_temperature must match pain_score: hot=7-10, warm=4-6, cold=0-3.
outreach_angle must reference the property by name and cite a specific real finding, not be generic.`,
      messages: [{
        role: 'user',
        content: `Property: ${property_name}
Location: ${loc}

Search results (${allResults.length} sources):
${excerpts}

Extract pain signals and service signals. Call aria_pain_intel_result.`,
      }],
    })

    const toolBlock = message.content.find(b => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined
    if (!toolBlock) throw new Error('No synthesis result from Claude')

    const result = toolBlock.input as {
      pain_signals: string[]
      service_signals: string[]
      pain_score: number
      service_score: number
      lead_temperature: 'hot' | 'warm' | 'cold'
      outreach_angle: string
      citations: Array<{ signal: string; source: string }>
    }

    // Persist to aria_research (non-blocking)
    void persistResult(userId, body, result)

    return NextResponse.json(result)

  } catch (err: any) {
    console.error('[aria/pain-intel]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── Persist helper ───────────────────────────────────────────────────────────

async function persistResult(
  userId: string,
  body: { property_name?: string; property_address?: string; city?: string; state?: string },
  result: {
    pain_signals: string[]
    service_signals: string[]
    pain_score: number
    service_score: number
    lead_temperature: string
    outreach_angle: string
    citations: Array<{ signal: string; source: string }>
  },
) {
  try {
    const ggUser = await getCurrentUser()
    const scope = await resolveOrgScope(ggUser)
    await supabase.from('aria_research').insert({
      org_id:           scope.own_id ?? null,
      property_name:    body.property_name ?? null,
      property_address: body.property_address ?? null,
      city:             body.city ?? null,
      state:            body.state ?? null,
      pain_score:       result.pain_score,
      service_score:    result.service_score,
      lead_temperature: result.lead_temperature,
      pain_signals:     JSON.stringify(result.pain_signals),
      service_signals:  JSON.stringify(result.service_signals),
      outreach_angle:   result.outreach_angle,
      citations:        JSON.stringify(result.citations),
    })
  } catch {
    // Non-blocking — never throw
  }
}
