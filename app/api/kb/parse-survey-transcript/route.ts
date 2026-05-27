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
import { currentUser }                from '@clerk/nextjs/server'
import { isTechAuthed }               from '@/lib/tech-auth'

export const maxDuration = 30
export const dynamic     = 'force-dynamic'

async function isPortalAuthed(): Promise<boolean> {
  try {
    const user = await currentUser()
    return !!user
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const techOk   = await isTechAuthed(req)
  const portalOk = techOk ? false : await isPortalAuthed()
  if (!techOk && !portalOk) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { transcript, propertyName } = await req.json()
    if (!transcript || typeof transcript !== 'string' || transcript.trim().length < 10) {
      return NextResponse.json({ error: 'transcript required (min 10 chars)' }, { status: 400 })
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const parseTool: Anthropic.Tool = {
      name: 'extract_devices',
      description: 'Extract all devices and equipment found in a site walk transcript.',
      input_schema: {
        type: 'object' as const,
        required: ['propertyName', 'devices'],
        properties: {
          propertyName: {
            type: 'string',
            description: 'Property/site name if mentioned, otherwise empty string.',
          },
          devices: {
            type: 'array',
            description: 'All devices and equipment found on site.',
            items: {
              type: 'object',
              required: ['name', 'brand', 'model', 'location', 'condition', 'action', 'notes'],
              properties: {
                name:      { type: 'string', description: 'Common device type name (e.g. Gate Operator, Camera, Access Reader, Intercom)' },
                brand:     { type: 'string', description: 'Manufacturer brand if mentioned, otherwise empty string' },
                model:     { type: 'string', description: 'Model number if mentioned, otherwise empty string' },
                location:  { type: 'string', description: 'Where the device is located (e.g. Main Gate, Lobby, Unit 101)' },
                condition: { type: 'string', enum: ['good', 'fair', 'poor'] },
                action:    { type: 'string', enum: ['keep', 'service', 'replace', 'new_install'] },
                notes:     { type: 'string', description: 'Specific details the tech mentioned about this device' },
              },
            },
          },
        },
      },
    }

    const message = await client.messages.create({
      model:       'claude-haiku-4-5-20251001',
      max_tokens:  4096,
      tools:       [parseTool],
      tool_choice: { type: 'tool', name: 'extract_devices' },
      system: `You are a field technician assistant for GateGuard, a multifamily access control company.
A tech has walked a property and narrated what they observed.
Extract every device or piece of equipment mentioned and call the extract_devices tool.

For condition: working fine = "good"; issues/intermittent = "fair"; broken/failed/damaged = "poor". Default: "good".
For action: working fine → "keep"; needs adjustment/cleaning → "service"; broken/end-of-life → "replace"; not yet installed → "new_install".`,

      messages: [{
        role: 'user',
        content: `Site walk transcript${propertyName ? ` for ${propertyName}` : ''}:\n\n${transcript.trim()}`,
      }],
    })

    const toolBlock = message.content.find(b => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined
    if (!toolBlock) throw new Error('Claude did not call the extract_devices tool.')
    const parsed = toolBlock.input as { propertyName?: string; devices?: any[] }

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
