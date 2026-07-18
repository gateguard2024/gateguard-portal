// GET /api/crm/opportunities/[id]/emails
// Everything the opportunity Emails tab needs in one call:
//   • connected      — whether the current user has an active Gmail connector
//   • threads        — email threads linked to this opportunity (with messages)
//   • suggestions    — synced-but-unlinked threads whose participants match this
//                      opportunity's contact emails (one click to link)
//   • contact_emails — the emails used for matching (compose pre-fill)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { opportunityInScope } from '@/lib/crm-scope'
import { opportunityContactEmails, ilikeOr } from '@/lib/email-match'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)
export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  if (!(await opportunityInScope(params.id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const user = await getCurrentUser()

  // The current user's Gmail connector (for compose + "connect Gmail" banner).
  const { data: channel } = await supabase
    .from('message_channels')
    .select('id, config, is_active, oauth_refresh_token')
    .eq('user_id', user.id)
    .eq('channel_type', 'gmail')
    .eq('is_active', true)
    .not('oauth_refresh_token', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const contactEmails = await opportunityContactEmails(supabase, params.id)

  // Linked threads (any connector — the whole team's mail can attach here).
  const { data: threads, error: thErr } = await supabase
    .from('message_threads')
    .select('id, subject, participants, last_message_at, unread_count, link_source, channel_id')
    .eq('linked_opportunity_id', params.id)
    .order('last_message_at', { ascending: false })
    .limit(50)
  if (thErr) return NextResponse.json({ error: thErr.message }, { status: 500 })

  const threadIds = (threads ?? []).map((t) => t.id)
  let messages: any[] = []
  if (threadIds.length) {
    const { data: msgs } = await supabase
      .from('messages')
      .select(
        'id, thread_id, direction, from_address, from_name, to_addresses, subject, body, body_html, status, sent_at, created_at',
      )
      .in('thread_id', threadIds)
      .order('created_at', { ascending: true })
    messages = msgs ?? []
  }
  const byThread: Record<string, any[]> = {}
  for (const m of messages) (byThread[m.thread_id] ??= []).push(m)

  // Suggestions: unlinked threads whose messages involve a known contact email.
  let suggestions: any[] = []
  const filter = ilikeOr('from_address', contactEmails)
  if (filter) {
    const { data: hits } = await supabase
      .from('messages')
      .select('thread_id')
      .or(filter)
      .limit(200)
    const hitIds = [...new Set((hits ?? []).map((h) => h.thread_id))]
    // Also catch threads where we only ever WROTE to the contact.
    const toIds = new Set<string>()
    for (const e of contactEmails.slice(0, 10)) {
      const { data: sentHits } = await supabase
        .from('messages')
        .select('thread_id')
        .contains('to_addresses', JSON.stringify([{ address: e }]))
        .limit(100)
      for (const h of sentHits ?? []) toIds.add(h.thread_id)
    }
    const allIds = [...new Set([...hitIds, ...toIds])].filter((id) => !threadIds.includes(id))
    if (allIds.length) {
      const { data: sugg } = await supabase
        .from('message_threads')
        .select('id, subject, participants, last_message_at, linked_opportunity_id, link_source')
        .in('id', allIds)
        .is('linked_opportunity_id', null)
        .order('last_message_at', { ascending: false })
        .limit(20)
      suggestions = sugg ?? []
    }
  }

  return NextResponse.json({
    connected: !!channel,
    channel_id: channel?.id ?? null,
    from_address: (channel?.config as any)?.from_address ?? null,
    contact_emails: contactEmails,
    threads: (threads ?? []).map((t) => ({ ...t, messages: byThread[t.id] ?? [] })),
    suggestions,
  })
}
