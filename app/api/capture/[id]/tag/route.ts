/**
 * Quick Log — AI auto-tag a capture (best-effort, non-blocking).
 * POST /api/capture/[id]/tag → Haiku classifies kind + extracts "about", updates the row.
 * Called fire-and-forget from /log after a capture is saved; safe no-op without a key.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const KINDS = ['call', 'todo', 'idea', 'note']

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ ok: false, skipped: 'no key' })
    const caller = await getCurrentUser()
    const { data: cap } = await supabase.from('capture_log').select('id, body, status').eq('id', params.id).eq('user_id', caller.id).maybeSingle()
    if (!cap || cap.status !== 'open') return NextResponse.json({ ok: false })

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      messages: [{
        role: 'user',
        content: `A salesperson jotted this quick note. Classify it and pull out who/what it's about.\n\nNote: "${String(cap.body).slice(0, 600)}"\n\nReply ONLY as compact JSON: {"kind":"call|todo|idea|note","about":"person or company or short topic, or empty"}\n- call = they spoke with / phoned someone.\n- todo = an action to do.\n- idea = a thought, concept, or thing to consider.\n- note = anything else.`,
      }],
    })
    const text = msg.content.map(b => (b.type === 'text' ? b.text : '')).join('').trim()
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
    let kind = 'note', about = ''
    try { const p = JSON.parse(json); if (KINDS.includes(p.kind)) kind = p.kind; if (typeof p.about === 'string') about = p.about.trim().slice(0, 80) } catch { /* keep defaults */ }

    const patch: Record<string, unknown> = { kind, updated_at: new Date().toISOString() }
    if (about) patch.about = about
    const { data } = await supabase.from('capture_log').update(patch).eq('id', params.id).eq('status', 'open').select('id, kind, about').single()
    return NextResponse.json({ ok: true, capture: data })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'tag failed' }, { status: 200 })
  }
}
