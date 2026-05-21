/**
 * POST /api/aria/research
 *
 * ARIA — Lead Intelligence Engine
 * Returns property intel, decision maker, intent signals, psychographic profile,
 * and 3 hyper-personalized email variants with predicted reply rates.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

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
              required: ['name', 'address', 'units', 'year_built', 'management_company', 'owner_entity', 'property_type', 'class', 'occupancy'],
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
                  severity:    { type: 'string', enum: ['high', 'medium', 'low'] },
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

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { query } = await req.json()
    if (!query?.trim()) return NextResponse.json({ error: 'query required' }, { status: 400 })

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      tools: [ariaResearchTool],
      tool_choice: { type: 'tool', name: 'aria_research_result' },
      system: `You are ARIA, GateGuard's AI marketing intelligence engine for multifamily property sales.

TARGETING LOGIC:
- Specific property/address in query → mode: "target", return 1 prospect
- Geographic area / company / general description → mode: "prospect", return 3 prospects

QUALITY STANDARDS:
- Property names should sound like real Atlanta/Dallas/Phoenix/Denver communities (e.g. "The Preserve at Sandy Springs", "Avalon Midtown", "Reserve at Legacy Park")
- Pain signal quotes must sound like real residents wrote them — gritty, specific, first person, under 120 chars
- Email bodies: replace [Name] with the actual decision_maker.name. Reference the actual property.name. Reference actual pain signals.
- Buy scores should be realistic (6.5–9.2 range), not all perfect 10s
- For each email variant body: write a complete 4-sentence email. Sentence 1: reference specific property + pain signal with source. Sentence 2: transition to GateGuard solution. Sentence 3: specific result/metric. Sentence 4: soft CTA. Sign off: "Best, Russel Feldman | GateGuard"`,

      messages: [{
        role: 'user',
        content: `ARIA research query: "${query.trim()}"

GateGuard offerings to weave into emails where relevant:
- Gate operators, access control (Brivo), intercoms, cameras — full stack install
- Visitor management: GateCard platform — resident app, mobile access, delivery management
- DirecTV/AT&T MDU bulk TV + internet for whole building
- The Elevate Model: $10/unit/mo GateGuard cost → $150/yr resident fee → $30/unit/yr net profit for property
- SARA Bridge: easy migration path from SARA Plus

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

    return NextResponse.json(data)

  } catch (err: any) {
    console.error('[aria/research]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
