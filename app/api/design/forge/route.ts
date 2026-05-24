/**
 * POST /api/design/forge
 *
 * FORGE AI — System I/O design generator.
 * Given a list of devices, generates a complete wiring/connection plan
 * including cable types, terminals, power summary, and BOM additions.
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getCurrentUser } from '@/lib/current-user'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DeviceInput {
  id: string
  name: string
  type: string
  location?: string
}

interface ForgeConnection {
  from_device: string
  from_terminal: string
  to_device: string
  to_terminal: string
  cable_type: string
  wire_gauge: string
  length_estimate_ft: number
  notes: string
}

interface ForgePowerEntry {
  device: string
  voltage: string
  amperage: string
  source: string
}

interface ForgeBomAddition {
  item: string
  qty: number
  reason: string
}

interface ForgeResult {
  connections: ForgeConnection[]
  power_summary: ForgePowerEntry[]
  bom_additions: ForgeBomAddition[]
  notes: string
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user.id || user.id === 'system') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const devices: DeviceInput[] = body.devices ?? []
    const context: string = body.context ?? ''

    if (!devices.length) {
      return NextResponse.json({ error: 'devices array is required and must not be empty' }, { status: 400 })
    }

    const deviceList = devices
      .map(d => `- ${d.name} (type: ${d.type}${d.location ? `, location: ${d.location}` : ''})`)
      .join('\n')

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: `You are FORGE, GateGuard's system design AI for multifamily access control. Given a list of devices to be installed, generate a complete system I/O design.

Return ONLY a valid JSON object. No markdown fences, no prose. Exact schema:
{
  "connections": [
    {
      "from_device": "device name string",
      "from_terminal": "specific terminal label e.g. Relay 1 COM",
      "to_device": "device name string",
      "to_terminal": "specific terminal label e.g. OPEN/COM",
      "cable_type": "cat6|2wire|coax|fiber|ac_power|4wire|18gauge",
      "wire_gauge": "e.g. 18 AWG, 22 AWG, CAT6",
      "length_estimate_ft": number,
      "notes": "any install notes or cautions"
    }
  ],
  "power_summary": [
    {
      "device": "device name",
      "voltage": "e.g. 120VAC, 12VDC, 24VAC",
      "amperage": "e.g. 2A, 500mA",
      "source": "where power comes from e.g. dedicated 20A circuit, operator AUX 12VDC"
    }
  ],
  "bom_additions": [
    {
      "item": "item name e.g. Din Rail Relay Module",
      "qty": 1,
      "reason": "why this is needed"
    }
  ],
  "notes": "overall design notes, warnings, or recommendations as a single string"
}

Domain knowledge:
- Gate operators (DK6050, DK9050, LiftMaster SL3000): need 120VAC dedicated circuit + 2-wire dry contact from access controller relay
- Brivo ACS300/ACS100: needs 12VDC power, Wiegand reader wiring (6-wire), relay output to operator, REX input
- Callboxes (DK1835): needs 16-26VAC power, relay output (2-wire) to operator OPEN/COM
- Loop detectors: needs 12VDC from operator AUX, 2-wire connection to loop in ground, NC output to operator safety input
- Photobeams: needs 12VDC, NC relay output to operator obstruction input (2-wire)
- Cameras: needs PoE (cat6 from switch) or 12VDC + coax for analog
- Mag locks: needs 12VDC from power supply, relay from access controller
- UniFi equipment: needs PoE cat6 from USW, or 120VAC for USW-Flex

Generate realistic length estimates based on typical multifamily property layouts.
Always include power wiring in connections (even 120VAC runs to gate operators).
Flag any safety-critical connections in notes.`,

      messages: [{
        role: 'user',
        content: `Design the complete system I/O for these devices:\n${deviceList}${context ? `\n\nAdditional context: ${context}` : ''}

Generate all connections, power requirements, any additional BOM items needed, and overall notes.`
      }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) {
      throw new Error(`FORGE returned no JSON: ${raw.slice(0, 200)}`)
    }

    const result: ForgeResult = JSON.parse(match[0])
    return NextResponse.json({ result })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[api/design/forge]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
