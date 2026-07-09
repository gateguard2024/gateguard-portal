/**
 * POST /api/nexus/opps/negotiate-coach
 * The Opportunity → Negotiate "ask the coach" assistant. Gives margin-safe
 * negotiation advice for a specific deal. Non-streaming JSON so the glass box
 * can render the answer in-line.
 *
 * Body: { question: string, deal?: { name?, units?, mrr?, monthly?, install? } }
 * Returns: { answer: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM = `You are a sales negotiation coach for Gate Guard dealers selling gate/access/camera systems and monthly monitoring to apartment communities.
Your job: help the rep close the deal WITHOUT giving away margin.
Rules:
- Protect the recurring monthly fee first — that is where the profit and IRR live. Prefer concessions that keep the monthly rate intact (free month, waived setup, added value) over cutting the monthly price.
- Be concrete and brief: 2-4 short moves the rep can say out loud, each with a one-line reason.
- If the customer pushes below a healthy margin, say so plainly and offer a value-add alternative.
- Talk like a helpful teammate. No jargon dumps. Plain English a new rep understands.`

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user.canViewCRM) {
      return NextResponse.json({ error: 'CRM access denied.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const question = typeof body.question === 'string' ? body.question.trim() : ''
    if (!question) {
      return NextResponse.json({ error: 'Ask the coach a question first.' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Coach is not configured yet.' }, { status: 503 })
    }

    const deal = (body.deal ?? {}) as Record<string, unknown>
    const dealLine = [
      deal.name ? `Deal: ${deal.name}` : null,
      deal.units ? `Units: ${deal.units}` : null,
      deal.mrr || deal.monthly ? `Proposed monthly: $${deal.mrr ?? deal.monthly}` : null,
      deal.install ? `Install: $${deal.install}` : null,
    ].filter(Boolean).join(' · ')

    const userContent = dealLine ? `${dealLine}\n\nRep asks: ${question}` : `Rep asks: ${question}`

    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: SYSTEM,
      messages: [{ role: 'user', content: userContent }],
    })

    const answer = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim()

    return NextResponse.json({ answer: answer || 'No advice generated — try rephrasing.' })
  } catch {
    return NextResponse.json({ error: 'Coach unavailable right now.' }, { status: 500 })
  }
}
