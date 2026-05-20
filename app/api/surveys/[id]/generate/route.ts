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

  const systemPrompt = `You are GateGuard's field survey AI. Analyze site survey data from access control and security system installations and produce professional, actionable output by calling the generate_survey_analysis tool.

GATEGUARD ACCESS PLAN PRICING (use these exact unit_price values in the BOM):
- Resident Vehicle Gate (working/integrated): 500  (per month recurring)
- Resident Vehicle Gate (not working/needs repair): 750
- Guest Vehicle Gate (working): 500
- Guest Vehicle Gate (not working): 750
- Primary Common Area Door (working): 500
- Primary Common Area Door (not working): 750
- Secondary Common Area Door (working): 500
- Secondary Common Area Door (not working): 750
- Access Plan per unit: 5  (per unit per month — use actual unit count from property as qty)
- Video Monitoring flat fee: 500  (per month)
- Standard labor: 125  (per hour)
- Emergency service call: 250  (one-time)

For BOM pricing: condition Good or Fair → use working price. Condition Poor → use not-working price.

For the ai_sow field: write the full Scope of Work as a single string using section headers in ALL CAPS. Include: SITE OVERVIEW, EQUIPMENT TO BE INSTALLED/REPLACED, EQUIPMENT TO BE SERVICED/RETAINED, LABOR SCOPE, SPECIAL CONDITIONS.`

  const userContent = `Property: ${survey.property_name || 'Unknown'}${survey.property_address ? `\nAddress: ${survey.property_address}` : ''}
Survey Date: ${survey.survey_date ?? 'Today'}
Surveyor: ${survey.surveyor_name ?? 'Unknown'}

DEVICES FOUND ON SITE:
${deviceList}

${survey.notes_raw ? `SURVEYOR NOTES:\n${survey.notes_raw}` : ''}
${survey.voice_transcript ? `VOICE TRANSCRIPT:\n${survey.voice_transcript}` : ''}`

  // ── Tool schema — forces Claude to return structured data via tool_use ──────
  // The Anthropic API JSON-encodes tool inputs itself, so literal newlines in
  // string fields (e.g. ai_sow) are correctly escaped before we ever see them.
  const surveyTool: Anthropic.Tool = {
    name: 'generate_survey_analysis',
    description: 'Generate a professional site survey analysis including SOW, BOM, recommendations, and timeline.',
    input_schema: {
      type: 'object' as const,
      required: ['ai_summary', 'ai_sow', 'ai_bom', 'ai_recommendations',
                 'ai_urgent_items', 'ai_install_notes', 'ai_timeline'],
      properties: {
        ai_summary: {
          type: 'string',
          description: '2-3 sentence executive summary of the site current state and work needed.',
        },
        ai_sow: {
          type: 'string',
          description: 'Full Scope of Work document. Use ALL CAPS section headers. Sections: SITE OVERVIEW, EQUIPMENT TO BE INSTALLED/REPLACED, EQUIPMENT TO BE SERVICED/RETAINED, LABOR SCOPE, SPECIAL CONDITIONS.',
        },
        ai_bom: {
          type: 'array',
          description: 'Bill of Materials line items.',
          items: {
            type: 'object',
            required: ['description', 'qty', 'unit', 'unit_price', 'priority', 'category'],
            properties: {
              description: { type: 'string' },
              sku:         { type: 'string'  },
              qty:         { type: 'number'  },
              unit:        { type: 'string', enum: ['each', 'ft', 'hr', 'lot', 'mo'] },
              unit_price:  { type: 'number', description: 'Monthly or one-time dollar amount (no $ sign, no /mo text)' },
              priority:    { type: 'string', enum: ['urgent', 'recommended', 'optional'] },
              category:    { type: 'string', enum: ['equipment', 'labor', 'material', 'service'] },
              notes:       { type: 'string' },
            },
          },
        },
        ai_recommendations: {
          type: 'array',
          items: {
            type: 'object',
            required: ['title', 'detail', 'priority'],
            properties: {
              title:    { type: 'string' },
              detail:   { type: 'string' },
              priority: { type: 'string', enum: ['urgent', 'recommended', 'optional'] },
            },
          },
        },
        ai_urgent_items: {
          type: 'array',
          items: {
            type: 'object',
            required: ['item', 'reason'],
            properties: {
              item:   { type: 'string' },
              reason: { type: 'string' },
            },
          },
        },
        ai_install_notes: {
          type: 'array',
          items: {
            type: 'object',
            required: ['note'],
            properties: {
              note: { type: 'string' },
            },
          },
        },
        ai_timeline: {
          type: 'string',
          description: 'Plain-text project timeline estimate, e.g. "Phase 1 (replacement): 1 day. Phase 2 (new install): 2 days. Total: 3 days."',
        },
      },
    },
  }

  let generated: Record<string, unknown>
  try {
    const message = await anthropic.messages.create({
      model:       'claude-haiku-4-5-20251001',
      max_tokens:  8192,
      system:      systemPrompt,
      messages:    [{ role: 'user', content: userContent }],
      tools:       [surveyTool],
      tool_choice: { type: 'tool', name: 'generate_survey_analysis' },
    })

    // With tool_choice forced, the first content block is always a tool_use block
    const toolBlock = message.content.find(b => b.type === 'tool_use') as
      Anthropic.ToolUseBlock | undefined

    if (!toolBlock) {
      throw new Error('Claude did not call the generate_survey_analysis tool.')
    }

    generated = toolBlock.input as Record<string, unknown>
  } catch (err) {
    console.error('Claude generation error:', err)
    return NextResponse.json({
      error: `AI generation failed: ${err instanceof Error ? err.message : String(err)}`,
    }, { status: 500 })
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
  const { data: updated, error: refetchErr } = await supabase
    .from('surveys')
    .select('*')
    .eq('id', params.id)
    .single()

  if (refetchErr) return NextResponse.json({ error: refetchErr.message }, { status: 500 })
  return NextResponse.json({ survey: updated })
}
