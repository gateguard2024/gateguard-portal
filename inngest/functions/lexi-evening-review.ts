// Lexi's nightly "Close out today, plan tomorrow" (opt-in, per person).
// Every 15 minutes: finds people whose chosen evening time has come (Eastern),
// then fans out one event each so every send runs and retries on its own.
// A send is "claimed" first (user_settings.lexi_evening_last_sent), so two runs
// can never text someone twice; a failed send gives the claim back for the retry.
import { createClient } from '@supabase/supabase-js'
import { inngest } from '@/inngest/client'
import { getUserById } from '@/lib/current-user'
import { lexiAccess } from '@/lib/lexi/access'
import { claimEveningSend, etClock, getEveningSettings, isDue, releaseEveningSend, sendEveningNudge } from '@/lib/lexi/evening'

export const lexiEveningReview = inngest.createFunction(
  {
    id: 'nexus-lexi-evening-review',
    name: 'Nexus: Lexi nightly review (plan tomorrow)',
    retries: 2,
    timeouts: { finish: '300s' },
    triggers: [
      { cron: '*/15 * * * *' },
      { event: 'lexi/evening.send' },
    ],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const single: string | undefined = event?.data?.user_id

    if (!single) {
      const due: string[] = await step.run('who-is-due', async () => {
        const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
        const { data, error } = await sb.from('user_settings').select('user_id, lexi_evening_on, lexi_evening_time, lexi_evening_days, lexi_evening_last_sent').eq('lexi_evening_on', true)
        if (error) throw new Error(error.message)
        const now = new Date()
        return (data ?? []).filter(r => isDue({ on: true, time: r.lexi_evening_time ?? '18:00', days: Array.isArray(r.lexi_evening_days) ? r.lexi_evening_days : [], lastSent: r.lexi_evening_last_sent ?? null }, now)).map(r => String(r.user_id))
      })
      if (due.length) await step.sendEvent('fan-out', due.map(user_id => ({ name: 'lexi/evening.send', data: { user_id, day: etClock().day } })))
      return { due: due.length }
    }

    const day: string = event?.data?.day ?? etClock().day
    return step.run(`send-${single}`, async () => {
      const u = await getUserById(single)
      if (!u) return 'skipped: user not found'
      if ((await lexiAccess(u)) === 'none') return 'skipped: Lexi is off for this user'
      const s = await getEveningSettings(single)
      if (s.error) return `failed: ${s.error}`
      if (!s.on) return 'skipped: turned off'
      if (!(await claimEveningSend(single, day))) return 'skipped: already sent tonight'
      const r = await sendEveningNudge(u, s)
      if (!r.ok) {
        // Config problems won't get better on retry; anything else gets the claim back and retries.
        if (/Twilio settings missing|No way to reach you|RESEND_API_KEY/i.test(r.error ?? '')) return `failed: ${r.error}`
        await releaseEveningSend(single, day)
        throw new Error(r.error ?? 'send failed')
      }
      return `sent: ${r.sent.join(' + ')}${r.error ? ` (${r.error})` : ''}`
    })
  },
)
