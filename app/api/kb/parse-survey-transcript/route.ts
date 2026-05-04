/**
 * POST /api/kb/parse-survey-transcript
 *
 * Takes a voice/text transcript from a site walk and uses Claude to extract
 * a structured device inventory. Designed for Plaud device recordings or
 * any dictated/typed site walk notes.
 *
 * Returns: { devices: SurveyDevice[], propertyName: string | null }
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic                      from '@anthropic-ai/sdk'

export const maxDuration = 30
export const dynamic     = 'force-dynamic'

function isTechAuthed(req: NextRequest): boolean {
  const code      = req.headers.get('x-tech-code')
  const validCode = process.env.TECH_ACCESS_CODE
  return !!(validCode && code && code === validCode)
}

export async function POST(req: NextRequest) {
  if (!isTechAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { transcript, propertyName } = await req.json()
    if (!transcript || typeof transcript !== 'string' || transcript.trim().length < 10) {
      return NextResponse.json({ error: 'transcript required (min 10 chars)' }, { status: 400 })
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const message = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      system: `You are a field technician assistant for GateGuard, a multifamily access control company.
A tech has walked a property and narrated what they observed into a voice recorder (Plaud device or similar).
You will receive a transcript of that recording — it may be rough, abbreviated, or informal.

Extract every device or piece of equipment mentioned and return structured JSON.

For each device, infer:
- name: common device type name (e.g. "Gate Operator", "Photobeam", "Callbox", "Loop Detector", "Access Reader", "Camera", "Door Strike", "Mag Lock", "Keypad", "Intercom", "Network Switch", etc.)
- brand: manufacturer if mentioned (e.g. DoorKing, LiftMaster, Brivo, UniFi, Hikvision, etc.) — or empty string
- model: model number if mentioned — or empty string
- location: where it is (e.g. "Main Gate", "Side Entry", "Parking Garage", "Lobby", "Unit 101 Door") — extract from context
- condition: "good" | "fair" | "poor" — infer from tech's description (working fine = good; issues mentioned = fair; broken/failed = poor; default = "good")
- action: "keep" | "service" | "replace" | "new_install" — infer from tech's description
  - working fine, no issues → "keep"
  - intermittent, dirty, needs adjustment, misaligned → "service"
  - broken, failed, damaged, end of life, needs replacement → "replace"
  - not yet installed, needs to be added, planned → "new_install"
- notes: any specific details the tech mentioned about this device (error codes, symptoms, observations)

Also extract a propertyName if the tech mentions the property/site name.

Respond ONLY with valid JSON — no prose, no markdown fences:
{
  "propertyName": "string or null",
  "devices": [
    {
      "name": "string",
      "brand": "string",
      "model": "string",
      "location": "string",
      "condition": "good" | "fair" | "poor",
      "action": "keep" | "service" | "replace" | "new_install",
      "notes": "string"
    }
  ]
}

If you cannot identify any devices, return { "propertyName": null, "devices": [] }.`,

      messages: [{
        role: 'user',
        content: `Site walk transcript${propertyName ? ` for ${propertyName}` : ''}:\n\n${transcript.trim()}`,
      }],
    })

    const raw   = message.content[0].type === 'text' ? message.content[0].text : ''
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error(`No JSON in Claude response: ${raw.slice(0, 200)}`)

    const parsed = JSON.parse(match[0])

    // Attach UUIDs to devices
    const devices = (parsed.devices ?? []).map((d: any) => ({
      id:        crypto.randomUUID(),
      name:      d.name      ?? '',
      brand:     d.brand     ?? '',
      model:     d.model     ?? '',
      location:  d.location  ?? '',
      condition: ['good', 'fair', 'poor'].includes(d.condition) ? d.condition : 'good',
      action:    ['keep', 'service', 'replace', 'new_install'].includes(d.action) ? d.action : 'keep',
      notes:     d.notes     ?? '',
    }))

    return NextResponse.json({
      devices,
      propertyName: parsed.propertyName ?? null,
    })

  } catch (err: any) {
    console.error('[parse-survey-transcript]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
