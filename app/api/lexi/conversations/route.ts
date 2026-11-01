/**
 * /api/lexi/conversations — the signed-in user's saved Lexi chats.
 *   GET            → { conversations: [{ id, title, updated_at }] } (latest 30)
 *   GET ?id=<uuid> → { conversation, messages: [{ role, content, cards, created_at }] }
 *   DELETE ?id=    → { ok: true }
 * Owner-only: every query is filtered by the caller's Clerk user id.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { LEXI_OFF_MESSAGE, lexiAccess } from '@/lib/lexi/access'
import { isSignedIn } from '@/lib/assistant-executor'

export const dynamic = 'force-dynamic'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function caller() {
  const user = await getCurrentUser()
  if (!isSignedIn(user)) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if ((await lexiAccess(user)) === 'none') return { error: NextResponse.json({ error: LEXI_OFF_MESSAGE }, { status: 403 }) }
  return { user }
}

export async function GET(req: NextRequest) {
  const c = await caller(); if (c.error) return c.error
  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    if (!UUID.test(id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 })
    const { data: conv, error } = await sb.from('lexi_conversations').select('id, title, updated_at').eq('id', id).eq('user_id', c.user.id).maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const { data: messages, error: e2 } = await sb.from('lexi_messages').select('role, content, cards, created_at').eq('conversation_id', id).order('created_at', { ascending: true }).limit(200)
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
    return NextResponse.json({ conversation: conv, messages: messages ?? [] })
  }
  const { data, error } = await sb.from('lexi_conversations').select('id, title, updated_at').eq('user_id', c.user.id).order('updated_at', { ascending: false }).limit(30)
  // Table missing (migration 199 not run) → just no history yet.
  if (error) return NextResponse.json({ conversations: [], notice: 'History isn’t available yet.' })
  return NextResponse.json({ conversations: data ?? [] })
}

export async function DELETE(req: NextRequest) {
  const c = await caller(); if (c.error) return c.error
  const id = req.nextUrl.searchParams.get('id') ?? ''
  if (!UUID.test(id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 })
  const { data, error } = await sb.from('lexi_conversations').delete().eq('id', id).eq('user_id', c.user.id).select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
