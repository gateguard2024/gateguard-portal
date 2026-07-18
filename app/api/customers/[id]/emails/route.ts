// GET /api/customers/[id]/emails
// Email threads linked to this customer organization (auto-matched via
// org_contacts.email by the Gmail sync, or manually linked). Follows the same
// light auth pattern as the other /api/customers/[id]/* routes.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  await getCurrentUser()

  const { data: threads, error } = await supabase
    .from('message_threads')
    .select('id, subject, participants, last_message_at, unread_count, link_source, linked_opportunity_id')
    .eq('linked_customer_org_id', params.id)
    .order('last_message_at', { ascending: false })
    .limit(30)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = (threads ?? []).map((t) => t.id)
  let messages: any[] = []
  if (ids.length) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('id, thread_id, direction, from_address, from_name, subject, body, body_html, sent_at, created_at')
      .in('thread_id', ids)
      .order('created_at', { ascending: true })
    messages = msgs ?? []
  }
  const byThread: Record<string, any[]> = {}
  for (const m of messages) (byThread[m.thread_id] ??= []).push(m)

  return NextResponse.json({
    threads: (threads ?? []).map((t) => ({ ...t, messages: byThread[t.id] ?? [] })),
  })
}
