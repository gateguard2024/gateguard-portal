/**
 * POST /api/tech/scan-asset
 *
 * Reads a photo of a device nameplate / label / QR and extracts structured
 * fields so a tech can add the device to a site in seconds.
 *
 * Auth: x-tech-code (field tool) OR Clerk session.
 * Body: { image: string (base64, no data: prefix) }
 * Response: { asset: { brand, model, serial, mac, category, name }, raw }
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth }          from '@clerk/nextjs/server'
import Anthropic         from '@anthropic-ai/sdk'
import { isTechAuthed }  from '@/lib/tech-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const techOk = await isTechAuthed(req)
  if (!techOk) {
    let userId: string | null = null
    try { const s = await auth(); userId = s.userId } catch { /* no clerk */ }
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { image } = await req.json()
    if (!image) return NextResponse.json({ error: 'image required' }, { status: 400 })

    const mediaType = image.startsWith('/9j') ? 'image/jpeg' : 'image/png'
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
          {
            type: 'text',
            text: `This is a photo of a security / access-control / low-voltage device — a nameplate, sticker label, QR/barcode label, or the device itself. Extract its identifying details.

Respond with ONLY valid JSON (no prose, no markdown fences) in exactly this shape:
{
  "brand": string|null,        // manufacturer, e.g. "Brivo", "Ubiquiti", "LiftMaster", "Altronix"
  "model": string|null,        // model number / part number, e.g. "ACS300", "UA-G3", "AL600ULACM"
  "serial": string|null,       // serial number if visible
  "mac": string|null,          // MAC address if visible (format XX:XX:XX:XX:XX:XX)
  "category": string|null,     // one of: camera, intercom, access control, gate operator, controller, reader, power, network, lock, sensor, other
  "name": string|null          // short human name, e.g. "Brivo ACS300 Access Controller"
}
Use null for anything not clearly visible. Do not guess serial or MAC.`,
          },
        ],
      }],
    })

    const block = message.content.find(b => b.type === 'text')
    const raw = block && block.type === 'text' ? block.text.trim() : '{}'
    let asset: Record<string, unknown> = {}
    try {
      const jsonStr = raw.replace(/^```(json)?/i, '').replace(/```$/, '').trim()
      asset = JSON.parse(jsonStr)
    } catch {
      asset = { brand: null, model: null, serial: null, mac: null, category: null, name: null }
    }

    return NextResponse.json({ asset, raw })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[tech/scan-asset]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
