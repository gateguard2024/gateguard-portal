import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { fetchGmailInbox, canModifyGmail, backfillGmailHtml } from '@/lib/mail-fetch'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function accountStatus(ch: any) {
  return {
    id: ch.id,
    email: ch.config?.from_address ?? ch.display_name,
    last_synced_at: ch.last_synced_at ?? null,
    last_error: ch.last_error ?? null,
    can_modify: canModifyGmail(ch),
    live: !!ch.gmail_history_id,
    gmail_inbox_unread: ch.config?.reconcile?.inbox_unread ?? null,
    checked_at: ch.config?.reconcile?.at ?? null,
  }
}

// GET /api/nexus/messages/sync → the signed-in user's Gmail accounts + health.
export async function GET() {
  const user = await getCurrentUser()
  const { data, error } = await supabase.from('message_channels').select('*')
    .eq('user_id', user.id).eq('channel_type', 'gmail').eq('is_active', true)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ accounts: (data ?? []).filter((c) => c.oauth_refresh_token).map(accountStatus) })
}

// POST /api/nexus/messages/sync   { channel_id?, query?, full?, force? }
// Pulls what changed in Gmail right now (the minute cron does the same in the background).
//  • query  → search ALL of Gmail and bring the matches in (returns thread_ids)
//  • full   → start over (last 30 days + labels)
//  • A mailbox synced < 20 s ago is skipped unless force/query — the cron or another tab
//    just did it.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any = {}
  try { body = await req.json() } catch { /* empty body is fine */ }
  const channelId: string | undefined = body?.channel_id
  const query: string | undefined = typeof body?.query === 'string' && body.query.trim() ? body.query.trim().slice(0, 300) : undefined

  let q = supabase.from('message_channels').select('*')
    .eq('user_id', user.id).eq('channel_type', 'gmail').eq('is_active', true)
  if (channelId) q = q.eq('id', channelId)
  const { data: channels, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const live = (channels ?? []).filter((c) => c.oauth_refresh_token)
  if (!live.length) return NextResponse.json({ ok: true, channels: 0, fetched: 0, accounts: [] })

  let fetched = 0, updated = 0
  let firstError: string | null = null
  let needsReconnect = false
  const threadIds: string[] = []
  for (const ch of live) {
    const recent = ch.last_synced_at && Date.now() - Date.parse(ch.last_synced_at) < 20_000
    if (recent && !query && !body?.full && !body?.force && ch.gmail_history_id) continue
    // A first (full) sync from the browser stays small so the screen isn't kept waiting;
    // the minute cron fills in the rest.
    const res = await fetchGmailInbox(supabase, ch, {
      query, full: body?.full === true,
      maxResults: query ? 50 : (!ch.gmail_history_id ? 150 : undefined),
    })
    fetched += res.fetched
    updated += res.updated ?? 0
    if (res.thread_ids) threadIds.push(...res.thread_ids)
    if (res.needs_reconnect) needsReconnect = true
    if (res.error && !firstError) firstError = res.error
    if (body?.backfill) { try { await backfillGmailHtml(supabase, ch) } catch { /* best-effort */ } }
  }

  const { data: after } = await supabase.from('message_channels').select('*')
    .eq('user_id', user.id).eq('channel_type', 'gmail').eq('is_active', true)
  return NextResponse.json(
    {
      ok: !firstError, channels: live.length, fetched, updated, error: firstError,
      needs_reconnect: needsReconnect, thread_ids: query ? threadIds : undefined,
      accounts: (after ?? []).filter((c) => c.oauth_refresh_token).map(accountStatus),
    },
    { status: firstError && !fetched ? 502 : 200 },
  )
}
