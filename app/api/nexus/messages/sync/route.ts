import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { inngest } from '@/inngest/client'
import { fetchGmailInbox } from '@/lib/mail-fetch'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// POST /api/nexus/messages/sync   { channel_id?, inline? }
// Refreshes inbound mail for the current user.
//  • Default: fires the Inngest "messages/mailbox.sync" event (background) and returns immediately.
//  • inline:true (or no Inngest event key configured): runs the Gmail fetch synchronously
//    so the Refresh button works even before the Inngest app is wired up.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    /* empty body is fine */
  }
  const channelId: string | undefined = body?.channel_id
  const inline = body?.inline === true || !process.env.INNGEST_EVENT_KEY

  if (!inline) {
    await inngest.send({
      name: 'messages/mailbox.sync',
      data: { user_id: user.id, channel_id: channelId ?? null },
    })
    return NextResponse.json({ queued: true })
  }

  // Inline path — sync this user's Gmail connectors now.
  let query = supabase
    .from('message_channels')
    .select('*')
    .eq('user_id', user.id)
    .eq('channel_type', 'gmail')
    .eq('is_active', true)
  if (channelId) query = query.eq('id', channelId)

  const { data: channels, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!channels?.length) return NextResponse.json({ ok: true, channels: 0, fetched: 0 })

  let fetched = 0
  let firstError: string | null = null
  const results: { channel_id: string; fetched: number; error?: string }[] = []
  for (const ch of channels) {
    const res = await fetchGmailInbox(supabase, ch)
    fetched += res.fetched
    results.push({ channel_id: ch.id, fetched: res.fetched, error: res.error })
    if (res.error && !firstError) firstError = res.error
  }
  // Surface the real reason a sync pulled 0 (token expired, Gmail API off, etc.)
  return NextResponse.json(
    { ok: !firstError, channels: channels.length, fetched, error: firstError, results },
    { status: firstError ? 502 : 200 },
  )
}
