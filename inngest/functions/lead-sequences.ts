/**
 * Lead email sequences — Inngest runner.
 *
 * Every 2 minutes, weekdays 8:00–16:58 Eastern: sends the sequence emails that are due,
 * at most ONE per rep per run (so each rep's emails go ~2 minutes apart, never a blast),
 * after checking each lead first — a reply, a bounce, Lost / Won / Do not email stops it.
 * One run at a time. All the rules are in lib/lead-sequences.ts.
 */
import { inngest } from '../client'
import { runDue } from '@/lib/lead-sequences'

export const leadSequences = inngest.createFunction(
  {
    id: 'nexus-lead-sequences',
    name: 'Nexus: Lead email sequences',
    retries: 0,
    concurrency: { limit: 1 },
    timeouts: { finish: '110s' },
    triggers: [{ cron: 'TZ=America/New_York */2 8-16 * * 1-5' }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ step }: any) => {
    return step.run('send-due', async () => {
      const r = await runDue(new Date())
      if (r.errors.length) console.error('[sequences] runner errors:', r.errors.slice(0, 10).join(' | '))
      return r
    })
  },
)
