// Lexi's morning brief. Weekdays at 6:30am Eastern, emails everyone who turned
// it on in Lexi (user_settings.lexi_brief_email). Each person gets only what
// they're allowed to see: the user is loaded from Clerk and every read goes
// through Lexi's scoped tools. Anyone Lexi is off for (lib/lexi/access.ts) is skipped. Safe to retry: a brief already sent today is not sent again.
// Also runs on the "lexi/brief.send" event for one user (data.user_id).
import { createClient } from '@supabase/supabase-js'
import { inngest } from '@/inngest/client'
import { getUserById } from '@/lib/current-user'
import { sendMorningBrief } from '@/lib/lexi/proactive'
import { lexiAccess } from '@/lib/lexi/access'

export const lexiMorningBrief = inngest.createFunction(
  {
    id: 'nexus-lexi-morning-brief',
    name: 'Nexus: Lexi morning brief',
    retries: 2,
    timeouts: { finish: '300s' },
    triggers: [
      { cron: 'TZ=America/New_York 30 6 * * 1-5' },
      { event: 'lexi/brief.send' },
    ],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const single: string | undefined = event?.data?.user_id

    const userIds: string[] = await step.run('who-gets-it', async () => {
      if (single) return [single]
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      const { data, error } = await sb.from('user_settings').select('user_id').eq('lexi_brief_email', true)
      if (error) throw new Error(error.message)
      return (data ?? []).map(r => String(r.user_id)).filter(Boolean)
    })

    const results: Record<string, string> = {}
    // One step per person, so a failure for one doesn't resend everyone else's.
    for (const uid of userIds) {
      results[uid] = await step.run(`brief-${uid}`, async () => {
        const u = await getUserById(uid)
        if (!u) return 'skipped: user not found'
        if ((await lexiAccess(u)) === 'none') return 'skipped: Lexi is off for this user'
        const r = await sendMorningBrief(u)
        if (!r.ok) throw new Error(r.error ?? 'send failed')
        return r.skipped ? `skipped: ${r.skipped}` : 'sent'
      })
    }
    return { users: userIds.length, results }
  },
)
