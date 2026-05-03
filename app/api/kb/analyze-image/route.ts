/**
 * POST /api/kb/analyze-image
 *
 * Claude Vision analysis for the tech tool photo capture step.
 * Accepts a base64 image + diagnostic context, returns a concise
 * technical observation for the field technician.
 *
 * Body: { image: string (base64), context: string }
 * Returns: { analysis: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth }                       from '@clerk/nextjs/server'
import Anthropic                      from '@anthropic-ai/sdk'

function isTechAuthed(req: NextRequest): boolean {
  const code      = req.headers.get('x-tech-code')
  const validCode = process.env.TECH_ACCESS_CODE
  return !!(validCode && code && code === validCode)
}

export async function POST(req: NextRequest) {
  const techOk = isTechAuthed(req)
  if (!techOk) {
    let userId: string | null = null
    try { const s = await auth(); userId = s.userId } catch { /* no clerk */ }
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { image, context } = await req.json()
    if (!image) return NextResponse.json({ error: 'image required' }, { status: 400 })

    // Detect image type from base64 header (JPEG or PNG)
    const mediaType = image.startsWith('/9j') ? 'image/jpeg' : 'image/png'

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const message = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          {
            type:   'image',
            source: { type: 'base64', media_type: mediaType, data: image },
          },
          {
            type: 'text',
            text: `You are a field technician diagnostic AI analyzing a photo taken on-site.

Context: ${context}

Describe what you observe that is relevant to diagnosing this issue. Focus on:
- LED indicator states (color, pattern, solid/flashing)
- Wiring condition (loose, burned, correct terminals)
- Component damage (burned marks, corrosion, physical damage)
- Display or panel readout
- Mechanical position or condition

Be specific and technical. Use exact component names if visible. Under 80 words. No preamble.`,
          },
        ],
      }],
    })

    const analysis = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    return NextResponse.json({ analysis })

  } catch (err: any) {
    console.error('[kb/analyze-image]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
