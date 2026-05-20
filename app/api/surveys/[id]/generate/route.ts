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
}

CRITICAL JSON RULES — your response must be parseable by JSON.parse():
1. Use the two-character sequence \\n (backslash + n) for line breaks in string values — NEVER a literal newline character.
2. Use \\t for tabs — NEVER a literal tab character inside a string value.
3. No trailing commas after the last item in any array or object.
4. All string values must use double quotes, properly escaped.`

  const userContent = `Property: ${survey.property_name || 'Unknown'}${survey.property_address ? `\nAddress: ${survey.property_address}` : ''}
Survey Date: ${survey.survey_date ?? 'Today'}
Surveyor: ${survey.surveyor_name ?? 'Unknown'}

DEVICES FOUND ON SITE:
${deviceList}

${survey.notes_raw ? `SURVEYOR NOTES:\n${survey.notes_raw}` : ''}
${survey.voice_transcript ? `VOICE TRANSCRIPT:\n${survey.voice_transcript}` : ''}`

  /**
   * Repair common JSON issues produced by LLMs:
   *
   * 1. Literal control characters (0x00–0x1F) inside string values
   *    — \n → \\n, \r → \\r, \t → \\t, others → \\uXXXX
   * 2. Trailing commas in arrays and objects  → removed
   *
   * Walks char-by-char tracking string/escape state so structural JSON is
   * never touched.
   */
  function repairLlmJson(raw: string): string {
    // ── pass 1: escape bare control characters inside strings ──────────────
    let inStr    = false
    let escaped  = false
    let p1       = ''
    for (let i = 0; i < raw.length; i++) {
      const ch   = raw[i]
      const code = ch.charCodeAt(0)
      if (escaped)            { p1 += ch; escaped = false; continue }
      if (ch === '\\')        { escaped = true;  p1 += ch; continue }
      if (ch === '"')         { inStr = !inStr;  p1 += ch; continue }
      if (inStr && code < 0x20) {
        if      (code === 0x0A) p1 += '\\n'
        else if (code === 0x0D) p1 += '\\r'
        else if (code === 0x09) p1 += '\\t'
        else p1 += `\\u${code.toString(16).padStart(4, '0')}`
        continue
      }
      p1 += ch
    }

    // ── pass 2: remove trailing commas before ] or } ───────────────────────
    // Handles both tightly packed and whitespace-separated forms.
    const p2 = p1.replace(/,(\s*[}\]])/g, '$1')

    return p2
  }

  let generated: Record<string, unknown>
  try {
    const message = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 8192,
      messages:   [{ role: 'user', content: userContent }],
      system:     systemPrompt,
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''

    // Strip optional markdown fences
    const stripped = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim()

    // Grab the outermost {...} block (guards against preamble / postamble)
    const match = stripped.match(/\{[\s\S]*\}/)
    if (!match) {
      throw new Error(`Claude returned no JSON object. Preview: ${stripped.slice(0, 400)}`)
    }

    const repaired = repairLlmJson(match[0])

    try {
      generated = JSON.parse(repaired)
    } catch (parseErr) {
      // Last-resort: log first 500 chars around the error position so we can debug
      const pos = parseErr instanceof SyntaxError
        ? parseInt((parseErr.message.match(/position (\d+)/) ?? [])[1] ?? '0', 10)
        : 0
      const ctx = repaired.slice(Math.max(0, pos - 80), pos + 80)
      console.error('[generate] JSON still invalid after repair. Context around error:', JSON.stringify(ctx))
      console.error('[generate] Parse error:', parseErr)
      throw parseErr
    }
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
