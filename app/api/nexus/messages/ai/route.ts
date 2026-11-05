import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 45

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const FAST = 'claude-haiku-4-5-20251001'
const SMART = process.env.LEXI_MODEL || 'claude-sonnet-4-6'

// Drop the quoted history ("On Tue … wrote:" and "> …" lines) so Lexi reads each email once.
function newPart(body: string): string {
  const lines = (body || '').replace(/\r/g, '').split('\n')
  const out: string[] = []
  for (const l of lines) {
    if (/^\s*>/.test(l)) continue
    if (/^On .{6,120}wrote:\s*$/i.test(l.trim()) || /^-{2,}\s*Original Message\s*-{2,}/i.test(l.trim()) || (/^From: .+/i.test(l.trim()) && out.length > 3)) break
    out.push(l)
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 4000)
}

// POST /api/nexus/messages/ai  { thread_id, action: 'summary' | 'draft', note? }
//  summary → 2–4 plain bullets + what they want from you
//  draft   → a reply in your voice (signature is added when you send)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'Lexi is not set up (ANTHROPIC_API_KEY).' }, { status: 503 })
  const body = await req.json().catch(() => ({}))
  const action = body?.action === 'draft' ? 'draft' : 'summary'
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 600) : ''
  const id = String(body?.thread_id ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Bad thread.' }, { status: 400 })
  const { data: thread } = await supabase.from('message_threads').select('*').eq('id', id).maybeSingle()
  if (!thread || thread.user_id !== user.id) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  const { data: msgs, error } = await supabase.from('messages').select('direction, from_name, from_address, body, subject, created_at')
    .eq('thread_id', id).order('created_at', { ascending: false }).limit(12)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const ordered = (msgs ?? []).reverse()
  if (!ordered.length) return NextResponse.json({ error: 'Nothing to read yet.' }, { status: 400 })

  const transcript = ordered.map((m) => {
    const who = m.direction === 'outbound' ? `${user.name} (me)` : `${m.from_name || m.from_address}`
    const when = new Date(m.created_at).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    return `--- ${who} · ${when}\n${newPart(m.body)}`
  }).join('\n\n')
  const linked = thread.linked_label ? `This conversation is linked to ${thread.linked_type ?? 'a record'}: ${thread.linked_label}.` : ''

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  try {
    if (action === 'summary') {
      const r = await anthropic.messages.create({
        model: FAST, max_tokens: 400,
        system: 'You summarize an email conversation for a busy CEO of Gate Guard (multifamily gate, access-control and camera company). Plain words a 5th grader could follow. Output exactly: 2–4 short bullet lines starting with "• ", then one line starting "They want: " (or "They want: nothing — FYI"), then one line starting "Next step: ". No preamble.',
        messages: [{ role: 'user', content: `Subject: ${thread.subject ?? ''}\n${linked}\n\n${transcript}` }],
      })
      const text = r.content.map((c) => (c.type === 'text' ? c.text : '')).join('').trim()
      return NextResponse.json({ text })
    }
    const r = await anthropic.messages.create({
      model: SMART, max_tokens: 700,
      system: `You write email replies as ${user.name} of Gate Guard (multifamily gate, access-control, camera and resident-app company). Write the reply to the newest email only. Warm, direct, short — usually 2–5 sentences. Plain words, no jargon, no exclamation-mark gushing, never invent prices, dates, or promises that aren't in the conversation or the note — if something is unknown, ask or say you'll confirm. Start with a greeting using their first name. Do NOT add a sign-off name or signature (it is added automatically) — end with a short closing line like "Thanks," on its own line. Output only the email body.`,
      messages: [{ role: 'user', content: `Subject: ${thread.subject ?? ''}\n${linked}\n\n${transcript}\n\n${note ? `What I want to say: ${note}` : 'Write the best reply.'}` }],
    })
    const text = r.content.map((c) => (c.type === 'text' ? c.text : '')).join('').trim()
    return NextResponse.json({ text })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Lexi could not answer.' }, { status: 502 })
  }
}
