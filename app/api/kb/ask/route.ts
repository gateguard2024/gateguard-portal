/**
 * POST /api/kb/ask
 *
 * AI diagnostic engine — vector search + Claude Y/N step generator.
 *
 * Body:
 *   symptom      string   — problem description
 *   product_id   string?  — restrict to one product
 *   error_code   string?  — optional error code
 *   history      Array<{ question, answer }>  — steps so far
 *   session_id   string?  — existing session for logging
 *
 * Returns:
 *   { type, text, detail, manual_ref, session_id }
 */

import { NextRequest, NextResponse }  from 'next/server'
import { auth }                        from '@clerk/nextjs/server'
import Anthropic                       from '@anthropic-ai/sdk'
import { searchKnowledge, serviceDb }  from '@/lib/vectorize'

function isTechAuthed(req: NextRequest): boolean {
  const code      = req.headers.get('x-tech-code')
  const validCode = process.env.TECH_ACCESS_CODE
  return !!(validCode && code && code === validCode)
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId && !isTechAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { symptom, product_id, error_code, history = [], session_id } = await req.json()
    if (!symptom) return NextResponse.json({ error: 'symptom required' }, { status: 400 })

    // ── 1. Build search query ─────────────────────────────────────────────
    const recentContext = (history as any[]).slice(-3)
      .map((h: any) => `${h.question} → ${h.answer}`).join('; ')
    const searchQuery = [symptom, error_code, recentContext].filter(Boolean).join('. ')

    // ── 2. Vector search ──────────────────────────────────────────────────
    const chunks = await searchKnowledge(searchQuery, product_id, 6, 0.40)

    // ── 3. Build manual context ───────────────────────────────────────────
    const context = chunks.length > 0
      ? chunks.map((c, i) =>
          `[${i + 1}] ${c.source === 'manual' ? `${c.product_name} manual` : 'KB article'}` +
          `${c.page_number ? ` p.${c.page_number}` : ''}` +
          `${c.section_title ? ` — ${c.section_title}` : ''}\n${c.content}`
        ).join('\n\n---\n\n')
      : 'No specific manual content found — use general field troubleshooting knowledge.'

    // ── 4. Build history text ─────────────────────────────────────────────
    const historyText = (history as any[]).length > 0
      ? '\n\nDiagnostic history:\n' +
        (history as any[]).map((h: any, i: number) => `Step ${i + 1}: "${h.question}" → ${h.answer}`).join('\n')
      : ''

    // ── 5. Claude ─────────────────────────────────────────────────────────
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const message = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: `You are GateGuard's field troubleshooting AI for dealers and technicians at multifamily properties.
You have real manual passages below. Use them for specific part names, terminal labels, LED colors, and error codes.

Respond ONLY with valid JSON — no prose, no markdown. Exact schema:
{
  "type": "question" | "action" | "resolved" | "escalate",
  "text": "string — the next question or instruction (max 120 chars, shown on mobile)",
  "detail": "string or null — extra context, expected values, what to look for",
  "manual_ref": { "url": "string or null", "page": number or null, "section": "string or null" }
}

Types:
  question  → a single yes/no diagnostic check
  action    → a specific thing to do right now (e.g. press Learn, reconnect wire)
  resolved  → issue identified and fixed
  escalate  → needs factory support or hardware replacement

Rules:
  - ONE question at a time, yes/no only
  - Use exact terminal names, LED labels, error codes from the manual
  - Progress: power → wiring → config → mechanical → replace
  - Keep "text" under 120 chars; put detail in "detail"
  - Always include manual_ref when citing a specific passage`,

      messages: [{
        role: 'user',
        content: `Problem: "${symptom}"${error_code ? `\nError code: ${error_code}` : ''}${historyText}\n\nRelevant manual/KB content:\n${context}\n\nWhat is the next diagnostic step?`
      }],
    })

    const raw  = message.content[0].type === 'text' ? message.content[0].text : ''
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error(`No JSON in Claude response: ${raw.slice(0, 200)}`)

    const step = JSON.parse(match[0])

    // Fill manual_ref from top chunk if Claude didn't set one
    if (!step.manual_ref?.url && chunks[0]?.manual_url) {
      step.manual_ref = { url: chunks[0].manual_url, page: chunks[0].page_number, section: chunks[0].section_title }
    }

    // ── 6. Log session ────────────────────────────────────────────────────
    const db = serviceDb()
    let sid  = session_id

    if (!sid) {
      const { data } = await db.from('troubleshoot_sessions')
        .insert({ product_id: product_id ?? null, user_id: userId, symptom, error_code: error_code ?? null, chunks_used: chunks.map(c => c.id) })
        .select('id').single()
      sid = data?.id
    } else {
      // append step non-blocking
      db.from('troubleshoot_sessions')
        .update({ steps_taken: db.rpc as any, updated_at: new Date().toISOString() })
        .eq('id', sid).then(() => {})
    }

    return NextResponse.json({ ...step, session_id: sid })

  } catch (err: any) {
    console.error('[kb/ask]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
