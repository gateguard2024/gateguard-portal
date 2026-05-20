import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope } from '@/lib/org-scope'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
export const dynamic = 'force-dynamic'

// POST /api/surveys/[id]/generate
// Calls Claude to generate SOW, BOM, recommendations from survey devices + notes.
// Saves results back to the survey record. Returns updated survey.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  // Load survey
  const { data: survey, error: fetchErr } = await supabase
    .from('surveys')
    .select('*')
    .eq('id', params.id)
    .single()

  if (fetchErr || !survey) {
    return NextResponse.json({ error: 'Survey not found' }, { status: 404 })
  }
  if (!user.isCorporate && !scope.ids.includes(survey.org_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Build prompt context
  const devices = Array.isArray(survey.devices) ? survey.devices : []
  const deviceList = devices.length
    ? devices.map((d: Record<string, string>, i: number) =>
        `${i + 1}. ${d.name ?? 'Device'}${d.brand ? ` (${d.brand}` : ''}${d.model ? ` ${d.model}` : ''}${d.brand ? ')' : ''} — Location: ${d.location ?? 'unknown'}, Condition: ${d.condition ?? 'unknown'}, Action: ${d.action ?? 'unknown'}${d.notes ? `. Notes: ${d.notes}` : ''}`
      ).join('\n')
    : 'No devices recorded.'

  const systemPrompt = `You are GateGuard's field survey AI. You analyze site survey data from access control and security system installations and produce professional, actionable documents.

You will receive a list of devices found on site plus any freeform notes from the surveyor. Your job is to produce:

1. **ai_summary** — 2-3 sentence executive summary of the site's current state and what work is needed.

2. **ai_sow** — A professional Scope of Work document (plain text, use section headers with ALL CAPS). Include: Site Overview, Equipment to be Installed/Replaced, Equipment to be Serviced/Retained, Labor Scope, Special Conditions.

3. **ai_bom** — Bill of Materials as a JSON array. Each item: { "description": string, "sku": string | null, "qty": number, "unit": "each"|"ft"|"hr"|"lot", "unit_price": number, "priority": "urgent"|"recommended"|"optional", "category": "equipment"|"labor"|"material"|"service", "notes": string | null }

4. **ai_recommendations** — JSON array of recommendations: { "title": string, "detail": string, "priority": "urgent"|"recommended"|"optional" }

5. **ai_urgent_items** — JSON array of urgent/safety items that need immediate attention: { "item": string, "reason": string }

6. **ai_install_notes** — JSON array of installation notes for the field team: { "note": string }

7. **ai_timeline** — Plain text estimate of project timeline (e.g., "Phase 1 (replacement): 1 day. Phase 2 (new install): 2 days. Total: 3 days").

GATEGUARD ACCESS PLAN PRICING (use these exact prices in BOM):
- Resident Vehicle Gate (working/integrated): $500.00/mo recurring
- Resident Vehicle Gate (not working/needs repair): $750.00/mo recurring
- Guest Vehicle Gate (working): $500.00/mo recurring
- Guest Vehicle Gate (not working/needs repair): $750.00/mo recurring
- Primary Common Area Door (working): $500.00/mo recurring
- Primary Common Area Door (not working/needs repair): $750.00/mo recurring
- Secondary Common Area Door (working): $500.00/mo recurring
- Secondary Common Area Door (not working/needs repair): $750.00/mo recurring
- Access Plan per unit: $5.00/unit/mo recurring (use actual unit count from property)
- Video Monitoring flat fee: $500.00/mo recurring
- Standard labor rate: $125.00/hr
- Emergency service call: $250.00 one-time

For BOM pricing: if device condition is "Good" or "Fair" use the working price; if "Poor" use the not-working price.

Respond ONLY with valid JSON in this exact shape:
{
  "ai_summary": "...",
  "ai_sow": "...",
  "ai_bom": [...],
  "ai_recommendations": [...],
  "ai_urgent_items": [...],
  "ai_install_notes": [...],
  "ai_timeline": "..."
}`

  const userContent = `Property: ${survey.property_name || 'Unknown'}${survey.property_address ? `\nAddress: ${survey.property_address}` : ''}
Survey Date: ${survey.survey_date ?? 'Today'}
Surveyor: ${survey.surveyor_name ?? 'Unknown'}

DEVICES FOUND ON SITE:
${deviceList}

${survey.notes_raw ? `SURVEYOR NOTES:\n${survey.notes_raw}` : ''}
${survey.voice_transcript ? `VOICE TRANSCRIPT:\n${survey.voice_transcript}` : ''}`

  let generated: Record<string, unknown>
  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: userContent }],
      system: systemPrompt,
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    // Strip markdown code fences if Claude wrapped in ```json
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    generated = JSON.parse(cleaned)
  } catch (err) {
    console.error('Claude generation error:', err)
    return NextResponse.json({ error: 'AI generation failed' }, { status: 500 })
  }

  // Save back to survey — split into two updates so a missing column on one
  // doesn't silently drop the other (e.g. if ai_urgent_items/ai_install_notes
  // columns weren't present when migration 041 originally ran).
  const coreUpdate: Record<string, unknown> = {
    ai_summary:         generated.ai_summary         ?? null,
    ai_sow:             generated.ai_sow             ?? null,
    ai_bom:             generated.ai_bom             ?? [],
    ai_recommendations: generated.ai_recommendations ?? [],
    ai_timeline:        generated.ai_timeline        ?? null,
    updated_at:         new Date().toISOString(),
  }

  const { error: coreErr } = await supabase
    .from('surveys')
    .update(coreUpdate)
    .eq('id', params.id)

  if (coreErr) {
    console.error('Survey core save error:', coreErr)
    return NextResponse.json({ error: `Save failed: ${coreErr.message}` }, { status: 500 })
  }

  // Try to save extended AI columns — non-fatal if columns don't exist yet
  void (async () => {
    try {
      await supabase
        .from('surveys')
        .update({
          ai_urgent_items:  generated.ai_urgent_items  ?? [],
          ai_install_notes: generated.ai_install_notes ?? [],
          updated_at:       new Date().toISOString(),
        })
        .eq('id', params.id)
    } catch (_) { /* columns may not exist — run migration 054 to add them */ }
  })()

  // Re-fetch the updated survey to return full data
  const { data: updated, error: fetchErr } = await supabase
    .from('surveys')
    .select('*')
    .eq('id', params.id)
    .single()

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  return NextResponse.json({ survey: updated })
}
