/**
 * POST /api/scout/scan
 *
 * SCOUT Market Intelligence Scanner — v1.1
 * Runs 4 targeted Tavily searches for the dealer's territory,
 * scores each result with Claude Haiku, and inserts into `scout_alerts`.
 *
 * Body: { city: string, state: string }
 * Returns: { new_alerts: number, alerts: ScoutAlert[] }
 */

import { NextRequest, NextResponse } from 'next/server'
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

// ── Claude scoring tool ──────────────────────────────────────────────────────

const scoutScoringTool: Anthropic.Tool = {
  name: 'scout_alerts_result',
  description: 'Return scored SCOUT alert records extracted from market intelligence results.',
  input_schema: {
    type: 'object' as const,
    required: ['alerts'],
    properties: {
      alerts: {
        type: 'array',
        items: {
          type: 'object',
          required: ['alert_type', 'title', 'summary', 'property_name', 'relevance_score'],
          properties: {
            alert_type: {
              type: 'string',
              enum: ['permit_expired', 'new_property_sale', 'competitor_news', 'pain_signal'],
            },
            title: { type: 'string', description: 'Short headline (under 80 chars).' },
            summary: { type: 'string', description: '1-2 sentences explaining the opportunity for GateGuard.' },
            property_name: { type: 'string', description: 'Property or entity name from the source, or the city/area.' },
            source_url: { type: 'string', description: 'Source URL from the search result.' },
            relevance_score: {
              type: 'number',
              description: '1-10 GateGuard sales relevance. 8-10 = immediate opportunity. 5-7 = worth monitoring. 1-4 = weak signal.',
            },
          },
        },
      },
    },
  },
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const ggUser = await getCurrentUser()
    if (!ggUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!process.env.TAVILY_API_KEY) {
      return NextResponse.json({ error: 'TAVILY_API_KEY not configured' }, { status: 503 })
    }

    const body = await req.json()
    const city: string = body.city || 'Atlanta'
    const state: string = body.state || 'GA'
    const loc = `${city}, ${state}`
    const curYear = new Date().getFullYear()

    const scope = await resolveOrgScope(ggUser)

    // ── 4 parallel Tavily searches ───────────────────────────────────────
    const [
      permitResults,
      painResults,
      saleResults,
      competitorResults,
    ] = await Promise.all([
      // 1. Old gate permits → aging gates
      tavilySearch(`multifamily apartment gate permit ${city} ${state} 2020 2021 2022`),
      // 2. Access control pain signals
      tavilySearch(`multifamily access control broken reviews ${city} ${state} ${curYear}`),
      // 3. New property acquisitions → new PM = new vendor opportunity
      tavilySearch(`apartment complex sale acquisition ${city} ${state} 2024 2025`),
      // 4. Competitor weaknesses
      tavilySearch(`SmartRent ButterflyMX Latch complaint issue ${city} ${state}`),
    ])

    // Tag each result with its alert type
    const taggedResults: Array<TavilyResult & { alert_type: string }> = [
      ...permitResults.map(r => ({ ...r, alert_type: 'permit_expired' })),
      ...painResults.map(r => ({ ...r, alert_type: 'pain_signal' })),
      ...saleResults.map(r => ({ ...r, alert_type: 'new_property_sale' })),
      ...competitorResults.map(r => ({ ...r, alert_type: 'competitor_news' })),
    ]

    // Deduplicate
    const seenUrls = new Set<string>()
    const uniqueResults = taggedResults
      .filter(r => {
        if (!r.url || seenUrls.has(r.url)) return false
        seenUrls.add(r.url)
        return r.score > 0.2
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)

    if (uniqueResults.length === 0) {
      return NextResponse.json({ new_alerts: 0, alerts: [] })
    }

    const excerpts = uniqueResults
      .map((r, i) => `[${i + 1}] TYPE:${r.alert_type}\n${r.title}\nURL: ${r.url}\n${r.content.slice(0, 350)}`)
      .join('\n\n---\n\n')

    // ── Claude Haiku scores and structures the alerts ────────────────────
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1536,
      tools: [scoutScoringTool],
      tool_choice: { type: 'tool', name: 'scout_alerts_result' },
      system: `You are SCOUT, GateGuard's market intelligence agent. GateGuard installs gate operators, access control (Brivo), cameras (Eagle Eye), and networking (UniFi) at multifamily properties. 
Analyze search results and extract actionable intelligence alerts. Only include results that contain real property or company names and a genuine sales signal. Discard generic news articles, press releases without property specifics, or content with no sales angle. 
Scoring guide: 9-10 = property name + active pain or sale confirmed. 7-8 = strong signal, property implied. 5-6 = worth monitoring. Below 5 = weak, skip if possible.`,
      messages: [{
        role: 'user',
        content: `Territory: ${loc}
Search results (${uniqueResults.length} items):
${excerpts}

Extract actionable SCOUT alerts. Call scout_alerts_result.`,
      }],
    })

    const toolBlock = message.content.find(b => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined
    if (!toolBlock) throw new Error('No result from Claude')

    const { alerts } = toolBlock.input as { alerts: Array<{
      alert_type: string
      title: string
      summary: string
      property_name: string
      source_url?: string
      relevance_score: number
    }> }

    if (!alerts || alerts.length === 0) {
      return NextResponse.json({ new_alerts: 0, alerts: [] })
    }

    // Insert into scout_alerts
    const rows = alerts
      .filter(a => a.relevance_score >= 4)
      .map(a => ({
        org_id:          scope.own_id ?? null,
        alert_type:      a.alert_type,
        title:           a.title,
        summary:         a.summary,
        property_name:   a.property_name,
        city,
        state,
        source_url:      a.source_url ?? null,
        relevance_score: a.relevance_score,
        actioned:        false,
      }))

    let insertedAlerts: typeof rows = []
    if (rows.length > 0) {
      const { data } = await supabase
        .from('scout_alerts')
        .insert(rows)
        .select()
      insertedAlerts = (data as typeof rows) ?? rows
    }

    return NextResponse.json({
      new_alerts: rows.length,
      alerts: insertedAlerts,
    })

  } catch (err: any) {
    console.error('[scout/scan]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
