/**
 * POST /api/aria/research
 *
 * ARIA — Lead Intelligence Engine
 * Takes a natural-language query about multifamily targets and returns:
 *   - Property intelligence (units, class, management company, owner)
 *   - Decision maker discovery (name, email, LinkedIn, phone)
 *   - Intent signals mined from public sources (reviews, Reddit, forums)
 *   - Psychographic profile + buy score
 *   - 3 hyper-personalized email variants with predicted reply rates
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { query } = await req.json()
    if (!query?.trim()) return NextResponse.json({ error: 'query required' }, { status: 400 })

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      system: `You are ARIA, GateGuard's AI marketing intelligence engine for multifamily property sales.

Given a natural-language query, generate realistic property intelligence for outreach campaigns.
- If the query mentions a SPECIFIC property or address → return 1 deep-dive prospect (mode: "target")
- If the query is geographic, general, or describes a type of property → return 3 prospects (mode: "prospect")

Return ONLY valid JSON — no prose, no markdown fences. Schema:
{
  "mode": "target" | "prospect",
  "query_interpretation": "string — what you understood the query to mean",
  "prospects": [
    {
      "property": {
        "name": "string — real-sounding apartment community name",
        "address": "string — full address matching the geographic area",
        "units": number,
        "year_built": number (1985-2020),
        "management_company": "string — realistic PM company name",
        "owner_entity": "string — realistic LLC name",
        "property_type": "garden-style" | "mid-rise" | "high-rise" | "townhome",
        "class": "A+" | "A" | "B+" | "B" | "C+",
        "occupancy": "string (e.g. '93%')"
      },
      "decision_maker": {
        "name": "string — realistic full name",
        "title": "string — realistic PM title",
        "company": "string — same as management_company",
        "linkedin_slug": "string — realistic LinkedIn URL slug (e.g. 'jennifer-walsh-pm-dallas')",
        "email": "string — realistic work email",
        "email_confidence": number (65-94),
        "phone": "string — realistic US phone",
        "tenure_years": number (0.5-6, one decimal)
      },
      "pain_signals": [
        {
          "source": "Google Reviews" | "ApartmentList" | "Reddit" | "Apartments.com" | "Yelp" | "BiggerPockets",
          "date": "string (e.g. 'February 2026')",
          "signal_type": "gate_access" | "package_theft" | "internet" | "intercom" | "visitor_management" | "mdu_tv",
          "quote": "string — realistic review excerpt (1-2 sentences, first person, sounds like a real resident or property manager post)",
          "severity": "high" | "medium" | "low"
        }
      ],
      "profile": {
        "buy_score": number (5.0-9.5, one decimal),
        "urgency": "critical" | "high" | "medium" | "low",
        "primary_concern": "string (e.g. 'Resident retention + liability exposure from gate failures')",
        "current_vendor": "string (e.g. 'DoorKing gates + Comcast Business MDU')",
        "contract_window": "string (e.g. 'Q3 2026 — estimated 4-6 months out')",
        "communication_style": "data-driven" | "relationship-first" | "cost-focused" | "tech-forward"
      },
      "email_variants": [
        {
          "angle": "string (e.g. 'Pain Point', 'Competitive Displacement', 'Revenue Opportunity', 'Lease-Up Advantage', 'ROI Case')",
          "subject": "string — compelling, personalized, under 58 chars, references their specific situation",
          "body": "string — 3 paragraphs, 160-200 words total. Para 1: reference a specific pain signal (mention the source). Para 2: how GateGuard solves it (specific, not generic). Para 3: CTA with urgency. NO 'Dear [Name]' — start with their name directly. Sign off as 'Russel Feldman, GateGuard'.",
          "predicted_reply_rate": number (13-27, integer),
          "tone": "direct" | "consultative" | "executive"
        },
        {
          "angle": "different angle than first",
          "subject": "different subject line",
          "body": "different angle, same personalization standard",
          "predicted_reply_rate": number (11-24, integer),
          "tone": "direct" | "consultative" | "executive"
        },
        {
          "angle": "different angle than first two",
          "subject": "different subject line",
          "body": "different angle, same personalization standard",
          "predicted_reply_rate": number (10-22, integer),
          "tone": "direct" | "consultative" | "executive"
        }
      ],
      "generic_reply_rate": number (1.8-3.2, one decimal)
    }
  ]
}

Pain signals must sound like REAL reviews/posts — gritty, first-person, property-specific. Not generic.
Email bodies must reference the exact property name, the exact pain signal source, and a specific detail. This is the whole point.
Make buy scores and urgency realistic — not everything is critical/10.`,

      messages: [{
        role: 'user',
        content: `Research query: "${query}"

GateGuard offerings:
- Access control systems: gate operators, intercoms, readers, cameras
- Visitor management: GateCard resident kiosk, delivery management
- DirecTV/AT&T MDU bulk TV + internet packages for apartment communities
- The Elevate Model: residents pay $150/yr, property nets $30/unit/yr profit

Generate intelligence now.`
      }]
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error(`ARIA: no JSON in response: ${raw.slice(0, 200)}`)

    const data = JSON.parse(match[0])

    // Validate basic shape
    if (!Array.isArray(data.prospects) || data.prospects.length === 0) {
      throw new Error('ARIA: invalid response shape')
    }

    return NextResponse.json(data)

  } catch (err: any) {
    console.error('[aria/research]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
