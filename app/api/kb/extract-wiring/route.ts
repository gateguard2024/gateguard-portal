/**
 * POST /api/kb/extract-wiring
 *
 * After a manual is indexed, reads the manual_chunks for the product and
 * asks Claude to extract terminal definitions + wiring pairings, then
 * stores the result in device_suggestions for use in WiringDiagram.
 *
 * Called automatically by processManual() and also available manually.
 *
 * Body: { product_id: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth }                       from '@clerk/nextjs/server'
import { serviceDb }                  from '@/lib/vectorize'
import Anthropic                      from '@anthropic-ai/sdk'

export const maxDuration = 60
export const dynamic     = 'force-dynamic'

const SYSTEM = `You are a field wiring expert for commercial access control and gate systems.
You will be given excerpts from a product installation manual.
Extract the terminal block definitions and output structured JSON.

You MUST respond with ONLY valid JSON in this exact shape — no markdown, no explanation:
{
  "device": {
    "id": "brand_model",
    "name": "Full Product Name",
    "brand": "Brand Name",
    "category": "one of: Access Controller | Gate Operator | Entry System | Electric Lock | Safety Device | Video Intercom | Network",
    "note": "one sentence install note for field techs",
    "terminals": [
      {
        "id": "unique_snake_case_id",
        "label": "EXACT BOARD LABEL",
        "desc": "human readable description",
        "type": "one of: vcc|gnd|relay_com|relay_no|relay_nc|input_no|input_nc|input_com|data_d0|data_d1|led|buzzer|rs485_a|rs485_b|ac_hot|ac_neutral|ac_ground|tamper|aux",
        "group": "Terminal group name matching board section"
      }
    ]
  },
  "wiring_hints": [
    "plain-english wiring note for common pairings, max 15 words each"
  ]
}

Rules:
- Use EXACT terminal labels from the manual (e.g. "COM1", "NO", "REX", "+12V")
- group should match the physical terminal block label (e.g. "Lock Relay 1 (J2)")
- For AC power terminals always use type: ac_hot / ac_neutral / ac_ground
- Include a caution note in device.note if there is AC mains wiring
- If the manual has no clear terminal table, do your best from wiring diagrams
- If insufficient data: return { "device": null, "wiring_hints": [] }`

export async function POST(req: NextRequest) {
  // Accept both Clerk session and tech code
  let authed = false
  try { const s = await auth(); if (s.userId) authed = true } catch { /**/ }
  const techCode = req.headers.get('x-tech-code')
  if (techCode && techCode === process.env.TECH_ACCESS_CODE) authed = true
  if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { product_id } = await req.json()
    if (!product_id) return NextResponse.json({ error: 'product_id required' }, { status: 400 })

    const db = serviceDb()

    // ── Pull product info ─────────────────────────────────────────────────
    const { data: product } = await db
      .from('products')
      .select('id, name, brand, sku, category, manual_url')
      .eq('id', product_id)
      .single()

    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

    // ── Pull relevant manual chunks ───────────────────────────────────────
    // Grab chunks likely to contain terminal/wiring data — filter by keywords
    const { data: allChunks } = await db
      .from('manual_chunks')
      .select('content, section_title, chunk_index')
      .eq('product_id', product_id)
      .order('chunk_index')

    if (!allChunks || allChunks.length === 0) {
      return NextResponse.json({ error: 'No manual chunks found — upload manual first' }, { status: 400 })
    }

    // Score chunks for wiring/terminal relevance
    const keywords = ['terminal', 'wiring', 'connector', 'relay', 'com', 'n.o.', 'n.c.',
                      'vcc', 'gnd', 'input', 'output', 'j1', 'j2', 'tb', 'pin', 'wire',
                      'connect', 'block', 'diagram', 'signal', 'volt', 'dc power', 'ac power']

    const scored = allChunks
      .map(c => {
        const lower = c.content.toLowerCase()
        const score = keywords.reduce((n, k) => n + (lower.split(k).length - 1), 0)
        return { ...c, score }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 12) // top 12 most relevant chunks, ~4800 tokens

    const manualExcerpt = scored
      .map(c => `[${c.section_title ?? `Chunk ${c.chunk_index}`}]\n${c.content}`)
      .join('\n\n---\n\n')

    // ── Ask Claude to extract terminal data ───────────────────────────────
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
    const msg = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system:     SYSTEM,
      messages: [{
        role:    'user',
        content: `Product: ${product.brand} ${product.name} (SKU: ${product.sku})\n\nManual excerpts:\n\n${manualExcerpt}`,
      }],
    })

    const raw = (msg.content[0] as { text: string }).text.trim()
    let parsed: { device: object | null; wiring_hints: string[] }
    try {
      parsed = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'Claude returned invalid JSON', raw }, { status: 500 })
    }

    if (!parsed.device) {
      return NextResponse.json({ found: false, message: 'Insufficient terminal data in manual' })
    }

    // ── Upsert into device_suggestions ───────────────────────────────────
    const { error: upsertErr } = await db
      .from('device_suggestions')
      .upsert({
        product_id,
        device_def:   parsed.device,
        wiring_hints: parsed.wiring_hints,
        status:       'ai_generated',
        updated_at:   new Date().toISOString(),
      }, { onConflict: 'product_id' })

    if (upsertErr) throw new Error(`DB upsert: ${upsertErr.message}`)

    return NextResponse.json({ success: true, device: parsed.device, wiring_hints: parsed.wiring_hints })

  } catch (err: any) {
    console.error('[kb/extract-wiring]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
