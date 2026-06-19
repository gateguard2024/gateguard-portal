/**
 * POST /api/kb/simplify — restate a diagnostic step in even simpler words.
 * Body: { text: string, detail?: string }
 * Response: { text, detail }
 * Auth: x-tech-code (field tool) OR Clerk.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth }         from '@clerk/nextjs/server'
import Anthropic        from '@anthropic-ai/sdk'
import { isTechAuthed } from '@/lib/tech-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

export async function POST(req: NextRequest) {
  if (!(await isTechAuthed(req))) {
    let userId: string | null = null
    try { const s = await auth(); userId = s.userId } catch { /* no clerk */ }
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { text, detail } = await req.json()
    if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 })

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
    const m = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content:
`Rewrite this field-service instruction so a nervous beginner (about 3rd-grade reading level) can do it. Rules: very short sentences, the most common everyday words, explain any technical word in plain language, keep the EXACT terminal/part labels (like "J2" or "OPEN") but say what they are. Do NOT change the actual action or any measurement value. Respond ONLY as JSON: {"text":"...", "detail":"..."}.

STEP: ${text}
${detail ? `DETAIL: ${detail}` : ''}` }],
    })
    const raw = m.content[0]?.type === 'text' ? m.content[0].text : '{}'
    const match = raw.match(/\{[\s\S]*\}/)
    const out = match ? JSON.parse(match[0]) : { text, detail: detail ?? null }
    return NextResponse.json({ text: out.text ?? text, detail: out.detail ?? null })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown' }, { status: 500 })
  }
}
