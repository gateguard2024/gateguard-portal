/**
 * Quick Log — capture inbox.
 * GET  /api/capture?status=open|done|triaged|all   → my captures (newest first)
 * POST /api/capture  { body, source?, kind?, about? }  → create a capture
 *
 * Personal: scoped to the current user only. One bucket (capture_log).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Fast, no-API guess so the stream self-sorts. User can override.
function guessKind(text: string): string {
  const t = text.toLowerCase()
  if (/\b(call|called|spoke|phone|left a (vm|voicemail)|rang|talked to)\b/.test(t)) return 'call'
  if (/\b(idea|what if|maybe we|we should|concept|thought)\b/.test(t)) return 'idea'
  if (/\b(todo|to-do|follow up|follow-up|need to|remember to|order|send|schedule|book|email|quote)\b/.test(t)) return 'todo'
  return 'note'
}

export async function GET(req: NextRequest) {
  try {
    const caller = await getCurrentUser()
    const status = new URL(req.url).searchParams.get('status') ?? 'all'
    let q = supabase.from('capture_log').select('*').eq('user_id', caller.id).order('created_at', { ascending: false }).limit(200)
    if (status !== 'all') q = q.eq('status', status)
    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message, records: [] }, { status: 200 })
    return NextResponse.json({ records: data ?? [] })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not load', records: [] }, { status: 200 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getCurrentUser()
    const body = await req.json().catch(() => ({}))
    const text = String(body.body ?? '').trim()
    if (!text) return NextResponse.json({ error: 'Nothing to log.' }, { status: 400 })

    const { data, error } = await supabase
      .from('capture_log')
      .insert({
        user_id:   caller.id,
        user_name: caller.name,
        org_id:    caller.org_id ?? null,
        body:      text,
        source:    body.source === 'voice' ? 'voice' : 'text',
        kind:      (typeof body.kind === 'string' && body.kind) ? body.kind : guessKind(text),
        about:     typeof body.about === 'string' && body.about.trim() ? body.about.trim() : null,
        status:    'open',
      })
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, capture: data })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not save' }, { status: 500 })
  }
}
