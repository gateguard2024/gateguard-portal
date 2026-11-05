/**
 * Nexus Mailbox Sync — Inngest Function (live Gmail)
 *
 * Two triggers:
 *   • cron  "* * * * *"               — every minute: each Gmail mailbox pulls only what
 *                                        changed since last time (Gmail history feed)
 *   • event "messages/mailbox.sync"    — on-demand, optionally scoped to { channel_id } or { user_id }
 *
 * New mail, read/unread, archive, star, trash and deletes all come across (lib/mail-fetch).
 * One run at a time so two syncs never race on the same mailbox.
 */

import { inngest } from '../client'
import { createClient } from '@supabase/supabase-js'
import { fetchGmailInbox } from '@/lib/mail-fetch'
import { isRingCentral, syncRingCentral } from '@/lib/ringcentral'

export const syncMailboxes = inngest.createFunction(
  {
    id: 'nexus-sync-mailboxes',
    name: 'Nexus: Sync Email Mailboxes',
    retries: 0,
    concurrency: { limit: 1 },
    timeouts: { finish: '240s' },
    triggers: [
      { cron: 'TZ=America/New_York * * * * *' },
      { event: 'messages/mailbox.sync' },
    ],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const channelId: string | undefined = event?.data?.channel_id
    const userId: string | undefined = event?.data?.user_id

    const channels = await step.run('list-mailboxes', async () => {
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      let query = supabase.from('message_channels').select('id, last_synced_at, gmail_history_id')
        .eq('channel_type', 'gmail').eq('is_active', true).not('oauth_refresh_token', 'is', null)
      // RingCentral texts + calls ride the same minute.
      let rcq = supabase.from('message_channels').select('id, config').eq('channel_type', 'phone').eq('is_active', true)
      if (channelId) rcq = rcq.eq('id', channelId)
      else if (userId) rcq = rcq.eq('user_id', userId)
      const { data: rcRows } = await rcq
      const rcIds = (rcRows ?? []).filter((c: { config?: { provider?: string } }) => c.config?.provider === 'ringcentral').map((c: { id: string }) => c.id)
      if (channelId) query = query.eq('id', channelId)
      else if (userId) query = query.eq('user_id', userId)
      let { data, error } = await query
      if (error && /gmail_history_id|column/i.test(error.message)) {
        // Before migration 222.
        let q2 = supabase.from('message_channels').select('id, last_synced_at')
          .eq('channel_type', 'gmail').eq('is_active', true).not('oauth_refresh_token', 'is', null)
        if (channelId) q2 = q2.eq('id', channelId)
        else if (userId) q2 = q2.eq('user_id', userId)
        const r2 = await q2
        data = r2.data as typeof data
        error = r2.error
      }
      if (error) throw new Error(error.message)
      return [...(data ?? []).map((c: { id: string }) => c.id), ...rcIds]
    })

    const results: Record<string, unknown> = {}
    // One step per mailbox: a slow or broken mailbox doesn't hold up the others.
    for (const id of channels as string[]) {
      results[id] = await step.run(`sync-${id}`, async () => {
        const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
        const { data: ch, error } = await supabase.from('message_channels').select('*').eq('id', id).maybeSingle()
        if (error || !ch) return { error: error?.message ?? 'gone' }
        // The browser just synced it — skip this minute.
        if (isRingCentral(ch)) {
          if (event?.name !== 'messages/mailbox.sync' && ch.last_synced_at && Date.now() - Date.parse(ch.last_synced_at) < 30_000) return { skipped: true }
          const rr = await syncRingCentral(supabase, ch)
          return { fetched: rr.fetched, updated: rr.updated, error: rr.error ?? null, provider: 'ringcentral' }
        }
        if (event?.name !== 'messages/mailbox.sync' && ch.gmail_history_id && ch.last_synced_at && Date.now() - Date.parse(ch.last_synced_at) < 30_000) return { skipped: true }
        const r = await fetchGmailInbox(supabase, ch)
        return { fetched: r.fetched, updated: r.updated ?? 0, removed: r.removed ?? 0, mode: r.mode, error: r.error ?? null }
      })
    }
    return { ok: true, mailboxes: (channels as string[]).length, results }
  },
)
