/**
 * POST /api/kb/resolve
 *
 * Called when a field tech confirms a diagnostic session is resolved.
 * Two things happen:
 *   1. troubleshoot_sessions row is updated: resolved=true, resolution_note=<what fixed it>
 *   2. A new kb_articles row is inserted + embedded so future AI searches
 *      surface this fix automatically — the learning loop.
 *
 * Auth: x-tech-code header (same as /api/kb/ask)
 */

import { NextRequest, NextResponse } from 'next/server'
import { serviceDb, embedBatch }     from '@/lib/vectorize'
import { isTechAuthed }              from '@/lib/tech-auth'

export const maxDuration = 30
export const dynamic     = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!await isTechAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const {
      session_id,
      product_id,
      symptom,
      history = [],
      resolution_note,
    } = await req.json() as {
      session_id:      string
      product_id?:     string
      symptom:         string
      history:         { question: string; answer: string }[]
      resolution_note: string
    }

    if (!session_id)      return NextResponse.json({ error: 'session_id required' },      { status: 400 })
    if (!symptom)         return NextResponse.json({ error: 'symptom required' },          { status: 400 })
    if (!resolution_note) return NextResponse.json({ error: 'resolution_note required' }, { status: 400 })

    const db = serviceDb()

    // 1. Mark session resolved
    await db
      .from('troubleshoot_sessions')
      .update({ resolved: true, resolution_note })
      .eq('id', session_id)

    // 2. Build KB article text for embedding
    //    Format: symptom + step-by-step history + what fixed it
    //    This lands in the vector index so future match_knowledge() calls surface it.
    const stepsText = (history as { question: string; answer: string }[])
      .map((h, i) => `Step ${i + 1}: ${h.question} → ${h.answer}`)
      .join('\n')

    const articleContent = [
      `SYMPTOM: ${symptom}`,
      stepsText ? `\nDIAGNOSTIC STEPS:\n${stepsText}` : '',
      `\nRESOLUTION: ${resolution_note}`,
    ].filter(Boolean).join('\n').trim()

    // Build a concise title from the symptom (first 100 chars, trimmed at word boundary)
    const rawTitle = `Fixed: ${symptom}`
    const title    = rawTitle.length > 100
      ? rawTitle.slice(0, 97).replace(/\s\S*$/, '') + '…'
      : rawTitle

    // 3. Embed the article content
    const [embedding] = await embedBatch([articleContent])

    // 4. Insert KB article (service role bypasses RLS)
    const { error: insertError } = await db.from('kb_articles').insert({
      product_id:    product_id ?? null,
      category:      'Field Resolution',
      title,
      description:   `Tech-confirmed fix for: ${symptom.slice(0, 200)}`,
      content:       articleContent,
      difficulty:    'Basic',
      author:        'Field Tech (verified)',
      embedding,
      active:        true,
    })

    if (insertError) {
      // Non-fatal: session was already updated; log and continue
      console.error('[kb/resolve] kb_articles insert failed:', insertError.message)
    }

    return NextResponse.json({ ok: true })

  } catch (err: any) {
    console.error('[kb/resolve]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
