/**
 * POST /api/kb/survey-proposal
 *
 * Takes a tech's site walk inventory and generates a structured proposal
 * using Claude. The proposal includes a summary, editable line items,
 * prioritized recommendations, and urgent action items.
 *
 * Auth: x-tech-code header (same as other /tech API routes)
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic                      from '@anthropic-ai/sdk'

export const maxDuration = 60
export const dynamic     = 'force-dynamic'

export interface SurveyDevice {
  id:           string
  name:         string
  brand:        string
  model:        string
  location:     string
  condition:    'good' | 'fair' | 'poor'
  action:       'keep' | 'service' | 'replace' | 'new_install'
  notes:        string
}

export interface ProposalLineItem {
  description: string
  qty:         number
  note:        string       // e.g. "Replace aging unit", "New installation"
  priority:    'urgent' | 'recommended' | 'optional'
}

export interface SurveyProposal {
  summary:         string
  lineItems:       ProposalLineItem[]
  recommendations: string[]
  urgentItems:     string[]
  installNotes:    string[]
}

export async function POST(req: NextRequest) {
  const code = req.headers.get('x-tech-code')
  if (!code || code !== process.env.TECH_ACCESS_CODE) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { propertyName, devices } = await req.json() as {
      propertyName: string
      devices:      SurveyDevice[]
    }

    if (!devices?.length) {
      return NextResponse.json({ error: 'No devices provided' }, { status: 400 })
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    // Build device inventory text for Claude
    const inventoryText = devices.map((d, i) => {
      const lines = [
        `${i + 1}. ${d.name}${d.brand ? ` (${d.brand}${d.model ? ' ' + d.model : ''})` : ''}`,
        `   Location: ${d.location || 'not specified'}`,
        `   Condition: ${d.condition}`,
        `   Recommended action: ${d.action.replace('_', ' ')}`,
      ]
      if (d.notes) lines.push(`   Notes: ${d.notes}`)
      return lines.join('\n')
    }).join('\n\n')

    const systemPrompt = `You are a GateGuard field technician assistant helping generate a site survey proposal for a multifamily access control system. You have deep expertise in gate operators, access controllers, intercoms, cameras, and entry systems.

Your job is to analyze a site walk inventory and produce a structured, professional proposal that a dealer can present to a property manager.

Rules:
- Be specific and practical — no generic filler
- Urgent items = safety hazards or system failures
- Recommended = will fail soon or limits functionality
- Optional = improvements that add value
- Line items should be actionable work orders or equipment replacements
- Install notes should be guidance for the actual technician doing the work
- Write the summary as a brief professional assessment (2-3 sentences max)`

    const userPrompt = `Site: ${propertyName || 'Property'}

FIELD INVENTORY (${devices.length} device${devices.length !== 1 ? 's' : ''} documented):

${inventoryText}

Generate a proposal JSON with this exact structure:
{
  "summary": "2-3 sentence professional site assessment",
  "lineItems": [
    {
      "description": "Specific work or equipment item",
      "qty": 1,
      "note": "Why this is needed",
      "priority": "urgent|recommended|optional"
    }
  ],
  "recommendations": ["Short actionable recommendation 1", "..."],
  "urgentItems": ["Items needing immediate attention — only if truly urgent"],
  "installNotes": ["Technician guidance note 1", "..."]
}

Only output valid JSON. No markdown, no explanation.`

    const msg = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    })

    const raw  = (msg.content[0] as { text: string }).text.trim()
    // Strip markdown code fences if Claude added them
    const json = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const proposal: SurveyProposal = JSON.parse(json)

    return NextResponse.json({ ok: true, proposal })

  } catch (err: any) {
    console.error('[survey-proposal]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
