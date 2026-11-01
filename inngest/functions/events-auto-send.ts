// Event emails marked "Send automatically" go out on their send date, at 9am
// Eastern on weekdays and weekends alike. Each email is its own step, so one
// failure never blocks the rest, and lib/events-send.ts only reaches guests who
// haven't had that email yet — a retry never double-sends.
import { createClient } from '@supabase/supabase-js'
import { inngest } from '@/inngest/client'
import { getUserById } from '@/lib/current-user'
import { sendCampaignStep } from '@/lib/events-send'
import { todayET } from '@/lib/tz'

export const eventsAutoSend = inngest.createFunction(
  {
    id: 'nexus-events-auto-send',
    name: 'Nexus: event emails (automatic send)',
    retries: 2,
    triggers: [{ cron: 'TZ=America/New_York 0 9 * * *' }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ step }: any) => {
    const due: { id: string; event_id: string }[] = await step.run('find-due', async () => {
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      const { data, error } = await sb.from('event_campaign_steps').select('id, event_id')
        .eq('auto_send', true).in('status', ['draft', 'scheduled', 'partial']).lte('send_at', todayET()).limit(200)
      if (error) throw new Error(error.message)
      return (data ?? []) as { id: string; event_id: string }[]
    })
    const results: Record<string, string> = {}
    for (const d of due) {
      results[d.id] = await step.run(`send-${d.id}`, async () => {
        const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
        const { data: evt, error } = await sb.from('property_events').select('status, host_name, host_user_id, created_by').eq('id', d.event_id).maybeSingle()
        if (error) throw new Error(error.message)
        if (!evt || evt.status === 'cancelled' || evt.status === 'delayed') return 'skipped: event cancelled or on hold'
        const host = await getUserById(String(evt.host_user_id || evt.created_by || ''))
        const r = await sendCampaignStep(d.event_id, d.id, { name: String(evt.host_name || host?.name || 'Gate Guard'), email: host?.email || null })
        if (r.ok) return `sent ${r.sent}${r.remaining ? `, ${r.remaining} left` : ''}`
        if (r.status >= 500 && r.status !== 503) throw new Error(r.error) // retry network / Resend trouble
        return `skipped: ${r.error}`
      })
    }
    return { due: due.length, results }
  },
)
