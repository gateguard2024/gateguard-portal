/**
 * POST /api/kb/ask
 *
 * AI diagnostic engine — vector search + Claude step generator.
 * Supports step types: question, action, measure, select, photo, resolved, escalate
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth }                       from '@clerk/nextjs/server'
import Anthropic                      from '@anthropic-ai/sdk'
import { searchKnowledge, serviceDb } from '@/lib/vectorize'

function isTechAuthed(req: NextRequest): boolean {
  const code      = req.headers.get('x-tech-code')
  const validCode = process.env.TECH_ACCESS_CODE
  return !!(validCode && code && code === validCode)
}

export async function POST(req: NextRequest) {
  const techOk = isTechAuthed(req)
  let userId: string | null = null
  if (!techOk) {
    try { const s = await auth(); userId = s.userId } catch { /* no clerk session */ }
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { symptom, product_id, error_code, history = [], session_id } = await req.json()
    if (!symptom) return NextResponse.json({ error: 'symptom required' }, { status: 400 })

    // 1. Build search query
    const recentContext = (history as any[]).slice(-3)
      .map((h: any) => `${h.question} → ${h.answer}`).join('; ')
    const searchQuery = [symptom, error_code, recentContext].filter(Boolean).join('. ')

    // 2. Vector search
    const chunks = await searchKnowledge(searchQuery, product_id, 6, 0.40)

    // 3. Manual context
    const context = chunks.length > 0
      ? chunks.map((c, i) =>
          `[${i + 1}] ${c.source === 'manual' ? `${c.product_name} manual` : 'KB article'}` +
          `${c.page_number ? ` p.${c.page_number}` : ''}` +
          `${c.section_title ? ` — ${c.section_title}` : ''}\n${c.content}`
        ).join('\n\n---\n\n')
      : 'No specific manual content found — use general field troubleshooting knowledge.'

    // 4. History text
    const historyText = (history as any[]).length > 0
      ? '\n\nDiagnostic history:\n' +
        (history as any[]).map((h: any, i: number) =>
          `Step ${i + 1}: "${h.question}" → ${h.answer}`
        ).join('\n')
      : ''

    // 5. Claude
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    const message = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: `You are GateGuard's field diagnostic AI for dealers and technicians servicing multifamily access control equipment.
You have real manual passages below. Use them for specific part names, terminal labels, LED colors, error codes, and voltage specs.

Respond ONLY with valid JSON — no prose, no markdown fences. Exact schema:
{
  "type": "question" | "action" | "measure" | "select" | "photo" | "resolved" | "escalate",
  "text": "string — the step instruction (max 120 chars, shown on mobile)",
  "detail": "string or null — extra context, wiring notes, what to look for",
  "unit": "string or null — measurement unit for measure steps (VAC, VDC, Ω, mA, ms)",
  "expected": "string or null — expected value/range for measure steps (e.g. '115±10', '>12', '0')",
  "choices": ["string"] or null,
  "manual_ref": { "url": "string or null", "page": number or null, "section": "string or null" }
}

Step types:
  question  → single yes/no check
  action    → specific physical action to perform
  measure   → record a measurement — always include unit + expected value/range
  select    → multiple choice (2-4 options) when yes/no is insufficient
  photo     → ask tech to photograph something specific for visual analysis
  resolved  → root cause found and fix confirmed
  escalate  → requires factory support, board replacement, or RMA

Rules:
  - ONE step at a time
  - Progress: power → wiring → config → sensors → mechanical → replace
  - Use exact terminal names, LED labels, error codes from the manual
  - Prefer measure when voltage/resistance data would confirm or rule out a cause
  - Prefer select when there are distinct observable states (LED colors, positions)
  - Use photo when visual evidence (damage, display state) would help diagnosis
  - Keep "text" under 120 chars; put technical detail in "detail"
  - Always set manual_ref when citing a specific manual passage`,

      messages: [{
        role: 'user',
        content: `Problem: "${symptom}"${error_code ? `\nError code: ${error_code}` : ''}${historyText}\n\nRelevant manual/KB content:\n${context}\n\nWhat is the next diagnostic step?`
      }],
    })

    const raw   = message.content[0].type === 'text' ? message.content[0].text : ''
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error(`No JSON in Claude response: ${raw.slice(0, 200)}`)

    const step = JSON.parse(match[0])

    // Fill manual_ref from top chunk if Claude didn't set one
    if (!step.manual_ref?.url && chunks[0]?.manual_url) {
      step.manual_ref = {
        url:     chunks[0].manual_url,
        page:    chunks[0].page_number,
        section: chunks[0].section_title,
      }
    }

    // 6. Log session
    const db  = serviceDb()
    let   sid = session_id

    if (!sid) {
      const { data } = await db.from('troubleshoot_sessions')
        .insert({
          product_id:  product_id ?? null,
          user_id:     userId,
          symptom,
          error_code:  error_code ?? null,
          chunks_used: chunks.map(c => c.id),
        })
        .select('id').single()
      sid = data?.id
    }

    return NextResponse.json({ ...step, session_id: sid })

  } catch (err: any) {
    console.error('[kb/ask]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
