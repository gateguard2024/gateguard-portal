import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

type UiChannel = 'call' | 'text' | 'email'

function uiChannel(sourceType: string): UiChannel {
  if (sourceType === 'sms' || sourceType === 'twilio') return 'text'
  if (sourceType === 'phone') return 'call'
  return 'email'
}

function firstParticipant(participants: any): { name: string; address: string } {
  const p = Array.isArray(participants) ? participants[0] : null
  return { name: p?.name ?? '', address: p?.address ?? '' }
}

// GET /api/nexus/messages/threads
// Returns conversations in the exact shape MessagesShell consumes, scoped to
// the current user's own threads.
export async function GET() {
  const user = await getCurrentUser()

  const { data: threads, error: thErr } = await supabase
    .from('message_threads')
    .select('*')
    .eq('user_id', user.id)
    .order('last_message_at', { ascending: false })
    .limit(100)
  if (thErr) return NextResponse.json({ error: thErr.message }, { status: 500 })

  const threadIds = (threads ?? []).map((t) => t.id)
  if (threadIds.length === 0) return NextResponse.json({ conversations: [] })

  const { data: msgs, error: mErr } = await supabase
    .from('messages')
    .select('id, thread_id, direction, source_type, body, body_html, subject, created_at, sent_at')
    .in('thread_id', threadIds)
    .order('created_at', { ascending: true })
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })

  const byThread = new Map<string, any[]>()
  for (const m of msgs ?? []) {
    if (!byThread.has(m.thread_id)) byThread.set(m.thread_id, [])
    byThread.get(m.thread_id)!.push(m)
  }

  const conversations = (threads ?? []).map((t) => {
    const tMsgs = byThread.get(t.id) ?? []
    const last = tMsgs[tMsgs.length - 1]
    const contact = firstParticipant(t.participants)
    const channel: UiChannel = last ? uiChannel(last.source_type) : 'email'
    return {
      id: t.id,
      contact_name: contact.name || contact.address || 'Unknown',
      company: null,
      channel,
      preview: last?.subject || last?.body || t.subject || '',
      unread: (t.unread_count ?? 0) > 0,
      needs_reply: (t.unread_count ?? 0) > 0,
      last_at: t.last_message_at ?? t.created_at,
      channel_id: t.channel_id ?? null,
      contact_address: contact.address || null,
      subject: t.subject || last?.subject || '',
      linked_type: t.linked_type ?? null,
      linked_id: t.linked_id ?? null,
      linked_label: t.linked_label ?? null,
      messages: tMsgs.map((m) => ({
        id: m.id,
        direction: m.direction === 'outbound' ? 'out' : 'in',
        channel: uiChannel(m.source_type),
        subject: m.subject || '',
        body: m.body || m.subject || '',
        body_html: m.body_html || '',
        at: m.created_at,
      })),
    }
  })

  return NextResponse.json({ conversations })
}
