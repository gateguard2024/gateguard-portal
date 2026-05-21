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

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

/** Aggressively clean a raw string so JSON.parse doesn't choke */
function safeParseJSON(raw: string): any {
  // Extract the outermost {...}
  const start = raw.indexOf('{')
  const end   = raw.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON object found in response')
  let s = raw.slice(start, end + 1)

  // Replace literal newlines / carriage returns / tabs inside JSON string values
  // Strategy: walk char by char, track whether we're inside a string
  let result = ''
  let inString = false
  let escaped = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (escaped) {
      result += ch
      escaped = false
      continue
    }
    if (ch === '\\' && inString) {
      result += ch
      escaped = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      result += ch
      continue
    }
    if (inString) {
      // Replace bare control characters with safe equivalents
      if (ch === '\n') { result += '\\n'; continue }
      if (ch === '\r') { result += '\\r'; continue }
      if (ch === '\t') { result += '\\t'; continue }
    }
    result += ch
  }

  try {
    return JSON.parse(result)
  } catch {
    // Nuclear fallback: strip ALL literal newlines and retry
    return JSON.parse(result.replace(/\n/g, ' ').replace(/\r/g, ' '))
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { query } = await req.json()
    if (!query?.trim()) return NextResponse.json({ error: 'query required' }, { status: 400 })

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: `You are ARIA, GateGuard's AI marketing intelligence engine for multifamily property sales.

CRITICAL JSON RULES — violations will break the parser:
- Return ONLY a valid JSON object. No prose, no markdown, no code fences.
- ALL string values must be on ONE line — never use literal newline characters inside a string value.
- Use \\n (backslash-n) if you need a line break inside a string.
- Escape any double quotes inside strings with \\".
- Do not use smart quotes — only straight ASCII double quotes.

TARGETING LOGIC:
- Specific property/address in query → mode: "target", return 1 prospect
- Geographic area / company / general description → mode: "prospect", return 3 prospects

JSON SCHEMA (follow exactly):
{
  "mode": "target" | "prospect",
  "query_interpretation": "one sentence describing what you understood",
  "prospects": [
    {
      "property": {
        "name": "Apartment community name",
        "address": "Full street address, City, ST ZIP",
        "units": 247,
        "year_built": 2008,
        "management_company": "Company Name",
        "owner_entity": "Owner LLC Name",
        "property_type": "garden-style",
        "class": "B+",
        "occupancy": "93%"
      },
      "decision_maker": {
        "name": "Full Name",
        "title": "Property Manager",
        "company": "Same as management_company",
        "linkedin_slug": "firstname-lastname-city",
        "email": "fname.lname@company.com",
        "email_confidence": 84,
        "phone": "(555) 000-0000",
        "tenure_years": 2.5
      },
      "pain_signals": [
        {
          "source": "Google Reviews",
          "date": "March 2026",
          "signal_type": "gate_access",
          "quote": "One-line resident quote — no line breaks — referencing a real-sounding complaint about the property",
          "severity": "high"
        },
        {
          "source": "ApartmentList",
          "date": "January 2026",
          "signal_type": "visitor_management",
          "quote": "Another one-line quote from a resident",
          "severity": "medium"
        },
        {
          "source": "Reddit",
          "date": "February 2026",
          "signal_type": "internet",
          "quote": "One-line post or comment referencing an issue",
          "severity": "medium"
        }
      ],
      "profile": {
        "buy_score": 8.2,
        "urgency": "high",
        "primary_concern": "Resident retention + liability from gate failures",
        "current_vendor": "DoorKing gates + Comcast Business MDU",
        "contract_window": "Q3 2026 — estimated 4-6 months out",
        "communication_style": "data-driven"
      },
      "email_variants": [
        {
          "angle": "Pain Point",
          "subject": "Subject line under 58 chars referencing their specific issue",
          "body": "Hi [Name], opening sentence referencing their specific property and a pain signal (cite the source). Second sentence: transition to GateGuard solution. Third sentence: specific result or metric. Fourth sentence: soft CTA — 15-min call this week? Best, Russel Feldman | GateGuard",
          "predicted_reply_rate": 22,
          "tone": "direct"
        },
        {
          "angle": "Revenue Opportunity",
          "subject": "Different subject line under 58 chars",
          "body": "Hi [Name], opening referencing the Elevate Model and how their gate install pays them back. Second sentence: specific numbers ($30/unit/yr net). Third sentence: how GateGuard delivers this at no cost to the property. Fourth sentence: CTA. Best, Russel Feldman | GateGuard",
          "predicted_reply_rate": 18,
          "tone": "consultative"
        },
        {
          "angle": "Competitive Displacement",
          "subject": "Different subject line under 58 chars",
          "body": "Hi [Name], opening sentence referencing their current vendor by name and a known pain point with that vendor. Second sentence: contrast with GateGuard's approach. Third sentence: proof point or stat. Fourth sentence: CTA. Best, Russel Feldman | GateGuard",
          "predicted_reply_rate": 15,
          "tone": "executive"
        }
      ],
      "generic_reply_rate": 2.3
    }
  ]
}

QUALITY STANDARDS:
- Property names should sound like real Atlanta/Dallas/Phoenix/Denver communities (e.g. "The Preserve at Sandy Springs", "Avalon Midtown", "Reserve at Legacy Park")
- Pain signal quotes must sound like real residents wrote them — gritty, specific, first person, under 120 chars
- Email bodies: replace [Name] with the actual decision_maker.name. Reference the actual property.name. Reference actual pain signals. Keep each email body as ONE continuous string with \\n between paragraphs if needed.
- Buy scores should be realistic (6.5–9.2 range), not all perfect 10s`,

      messages: [{
        role: 'user',
        content: `ARIA research query: "${query.trim()}"

GateGuard offerings to weave into emails where relevant:
- Gate operators, access control (Brivo), intercoms, cameras — full stack install
- Visitor management: GateCard platform — resident app, mobile access, delivery management
- DirecTV/AT&T MDU bulk TV + internet for whole building
- The Elevate Model: $10/unit/mo GateGuard cost → $150/yr resident fee → $30/unit/yr net profit for property
- SARA Bridge: easy migration path from SARA Plus

Return the JSON object now.`
      }]
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    if (!raw) throw new Error('Empty response from AI')

    const data = safeParseJSON(raw)

    if (!Array.isArray(data.prospects) || data.prospects.length === 0) {
      throw new Error('No prospects in response — try rephrasing your query')
    }

    return NextResponse.json(data)

  } catch (err: any) {
    console.error('[aria/research]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
