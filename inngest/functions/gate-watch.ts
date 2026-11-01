// Gate Watch — every minute, check the gates that are due (lib/gate-watch.ts).
// Open gates are re-checked every minute, closed ones every 2, so the "left open"
// limit is accurate while quiet nights stay cheap (most checks are free quick checks).
// Also runs on "gate-watch/run" for an immediate pass.
import { inngest } from '@/inngest/client'
import { runDueGates } from '@/lib/gate-watch'

export const gateWatch = inngest.createFunction(
  {
    id: 'nexus-gate-watch',
    name: 'Nexus: Gate Watch (gate left open)',
    retries: 0,                       // the next minute is the retry
    concurrency: { limit: 1 },
    timeouts: { finish: '120s' },
    triggers: [{ cron: '* * * * *' }, { event: 'gate-watch/run' }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ step }: any) => {
    const r = await step.run('check-due-gates', () => runDueGates(40))
    if (r.errors.length) console.error('[gate-watch]', r.errors.slice(0, 10))
    return r
  },
)
