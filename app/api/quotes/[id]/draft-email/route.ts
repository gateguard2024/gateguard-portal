import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export const dynamic = 'force-dynamic'

// POST /api/quotes/[id]/draft-email
// Generates a high-reaction-rate proposal email using Claude.
// Body: { proposalUrl: string }
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { proposalUrl } = await req.json().catch(() => ({}))
  if (!proposalUrl) return NextResponse.json({ error: 'proposalUrl required' }, { status: 400 })

  // Fetch the quote
  const { data: quote, error } = await supabase
    .from('quotes')
    .select(`
      id, quote_number, property_name, units, client_name, client_email,
      property_address, cover_message, created_by_name,
      total_one_time, total_mrr, deposit_percent, discount_percent,
      payment_plan, ramp_up_start_pct, ramp_up_full_month,
      quote_line_items (
        description, qty, unit_price, is_recurring, is_optional, is_included
      )
    `)
    .eq('id', params.id)
    .single()

  if (error || !quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

  // Build a compact summary of the quote for Claude
  const lineItems = (quote.quote_line_items ?? []) as Array<{
    description: string; qty: number; unit_price: number;
    is_recurring: boolean; is_optional?: boolean; is_included?: boolean;
  }>

  const oneTimeTotal = lineItems
    .filter(i => !i.is_recurring)
    .reduce((s, i) => s + i.qty * i.unit_price, 0)

  const mrrTotal = lineItems
    .filter(i => i.is_recurring)
    .reduce((s, i) => s + i.qty * i.unit_price, 0)

  const depositPct   = quote.deposit_percent ?? 50
  const depositDue   = (oneTimeTotal * depositPct / 100) + mrrTotal

  const topItems = lineItems
    .filter(i => !i.is_recurring && i.unit_price > 0)
    .sort((a, b) => b.qty * b.unit_price - a.qty * a.unit_price)
    .slice(0, 4)
    .map(i => `• ${i.description} (${i.qty > 1 ? i.qty + 'x ' : ''}$${Math.round(i.unit_price).toLocaleString()})`)
    .join('\n')

  const isRampUp     = quote.payment_plan === 'ramp_up'
  const rampNote     = isRampUp
    ? `The monthly rate ramps up starting at ${quote.ramp_up_start_pct ?? 10}% and reaches full rate in month ${quote.ramp_up_full_month ?? 14} — giving the property time to onboard residents before paying full rate.`
    : ''

  const prompt = `You are a senior sales professional at GateGuard, a premium multifamily access control company. Write a short, high-converting proposal email.

QUOTE DETAILS:
Property: ${quote.property_name ?? 'the property'}
${quote.units ? `Units: ${quote.units}` : ''}
${quote.property_address ? `Address: ${quote.property_address}` : ''}
Contact: ${quote.client_name ?? 'the property manager'}
One-time setup: $${Math.round(oneTimeTotal).toLocaleString()}
Monthly service: $${Math.round(mrrTotal).toLocaleString()}/mo
Deposit due at signing: $${Math.round(depositDue).toLocaleString()}
${rampNote}
Top line items:
${topItems || '• GateGuard access control + camera system'}

Proposal link: ${proposalUrl}
Quote number: ${quote.quote_number}

INSTRUCTIONS:
- Write a SHORT email (4–6 short paragraphs, max 200 words in body)
- Subject line should be specific and compelling — reference the property name
- Open with ONE line of genuine context or rapport (not "Hope you're well")
- Briefly mention 2–3 concrete things included (from the line items above)
- Reference the financials naturally — frame monthly as "per unit per month" if units > 0
- If there's a ramp-up plan, mention it as a client-friendly benefit
- One clear CTA sentence before the link
- End with genuine next step (call/questions), not a "Let me know if you have questions"
- Tone: confident, direct, warm. Not salesy. Not corporate. Not over-eager.
- Return ONLY valid JSON: { "subject": "...", "body": "..." }
- The body should use \\n for line breaks. No HTML.
- Do NOT include a signature block — the sender will add their own.`

  const message = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''

  // Parse JSON from the response
  let subject = `Your GateGuard Proposal — ${quote.property_name ?? quote.quote_number}`
  let body    = raw

  try {
    // Strip any markdown code fences if present
    const jsonStr = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
    const parsed  = JSON.parse(jsonStr)
    if (parsed.subject) subject = parsed.subject
    if (parsed.body)    body    = parsed.body
  } catch {
    // If JSON parse fails, try to extract subject/body manually
    const subjectMatch = raw.match(/["']subject["']\s*:\s*["']([^"']+)["']/i)
    const bodyMatch    = raw.match(/["']body["']\s*:\s*["']([\s\S]+?)["']\s*}/i)
    if (subjectMatch) subject = subjectMatch[1]
    if (bodyMatch)    body    = bodyMatch[1].replace(/\\n/g, '\n')
  }

  return NextResponse.json({ subject, body })
}
