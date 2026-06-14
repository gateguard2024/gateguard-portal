/**
 * Nexus Mailbox Sync — Inngest Function
 *
 * Two triggers:
 *   • cron  "*\/10 * * * *"            — every 10 min, sync all active Gmail connectors
 *   • event "messages/mailbox.sync"    — on-demand sync (from the Refresh button),
 *                                         optionally scoped to { channel_id } or { user_id }
 *
 * Pulls recent inbound Gmail into message_threads / messages via fetchGmailInbox.
 * SMTP connectors are send-only today, so only channel_type='gmail' is synced.
 */

import { inngest } from '../client'
import { createClient } from '@supabase/supabase-js'
import { fetchGmailInbox } from '@/lib/mail-fetch'

export const syncMailboxes = inngest.createFunction(
  {
    id: 'nexus-sync-mailboxes',
    name: 'Nexus: Sync Email Mailboxes',
    retries: 1,
    timeouts: { finish: '120s' },
    triggers: [
      { cron: '*/10 * * * *' },
      { event: 'messages/mailbox.sync' },
    ],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const channelId: string | undefined = event?.data?.channel_id
    const userId: string | undefined = event?.data?.user_id

    const result = await step.run('sync-gmail-channels', async () => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )

      let query = supabase
        .from('message_channels')
        .select('*')
        .eq('channel_type', 'gmail')
        .eq('is_active', true)
      if (channelId) query = query.eq('id', channelId)
      else if (userId) query = query.eq('user_id', userId)

      const { data: channels, error } = await query
      if (error) return { error: error.message }
      if (!channels?.length) return { channels: 0, fetched: 0 }

      let totalFetched = 0
      const perChannel: Record<string, number> = {}
      for (const ch of channels) {
        const res = await fetchGmailInbox(supabase, ch)
        perChannel[ch.id] = res.fetched
        totalFetched += res.fetched
      }
      return { channels: channels.length, fetched: totalFetched, perChannel }
    })

    return { ok: true, ...result }
  },
)
