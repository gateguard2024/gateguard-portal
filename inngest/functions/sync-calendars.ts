// Scheduled two-way Google Calendar sync. Every 15 minutes, syncs every user
// who has connected Google Calendar (a stored refresh token). Also runs on the
// "calendar/sync.user" event for a single user (used by push-on-create fallback).
import { createClient } from '@supabase/supabase-js'
import { inngest } from '@/inngest/client'
import { syncUserCalendar } from '@/lib/gcal-sync'

export const syncCalendars = inngest.createFunction(
  {
    id: 'nexus-sync-calendars',
    name: 'Nexus: Sync Google Calendars',
    retries: 1,
    timeouts: { finish: '180s' },
    triggers: [
      { cron: '*/15 * * * *' },
      { event: 'calendar/sync.user' },
    ],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const single: string | undefined = event?.data?.user_id

    return step.run('sync-google-calendars', async () => {
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

      let userIds: string[] = []
      if (single) {
        userIds = [single]
      } else {
        const { data } = await supabase
          .from('user_settings')
          .select('user_id')
          .not('gcal_refresh_token', 'is', null)
        userIds = (data ?? []).map(r => r.user_id).filter(Boolean)
      }

      let pulled = 0, pushed = 0, errors = 0
      for (const uid of userIds) {
        try {
          const r = await syncUserCalendar(uid)
          pulled += r.pulled; pushed += r.pushed; errors += r.pull_errors + r.push_errors
        } catch { errors++ }
      }
      return { users: userIds.length, pulled, pushed, errors }
    })
  },
)
