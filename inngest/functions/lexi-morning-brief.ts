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

    // The daily run fans out one event per person, so each brief runs (and
    // retries) on its own — one bad account never blocks everyone after it.
    if (!single) {
      if (userIds.length) await step.sendEvent('fan-out', userIds.map(user_id => ({ name: 'lexi/brief.send', data: { user_id } })))
      return { users: userIds.length, fannedOut: true }
    }

    const results: Record<string, string> = {}
    for (const uid of userIds) {
      results[uid] = await step.run(`brief-${uid}`, async () => {
        const u = await getUserById(uid)
        if (!u) return 'skipped: user not found'
        if (!u.email) return 'skipped: no email address'
        if ((await lexiAccess(u)) === 'none') return 'skipped: Lexi is off for this user'
        const r = await sendMorningBrief(u)
        // Only retry what can get better (Resend / network); a config problem won't.
        if (!r.ok) {
          if (/RESEND_API_KEY|not configured|no email/i.test(r.error ?? '')) return `failed: ${r.error}`
          throw new Error(r.error ?? 'send failed')
        }
        return r.skipped ? `skipped: ${r.skipped}` : 'sent'
      })
    }
    return { users: userIds.length, results }
  },
)
