// Brivo door events → our database, every hour (lib/brivo-events-store.ts, migration 241).
// Each active property with a Brivo login gets its own step (a failure at one property
// doesn't stop the rest; its window is retried next hour). First run per property
// backfills the last 30 days. Then events older than 30 days are deleted.
// Also runs on "brivo-events/sync" for an immediate pass.
import { inngest } from '@/inngest/client'
import { sitesWithBrivo, syncSite, pruneOld } from '@/lib/brivo-events-store'

export const brivoEventsSync = inngest.createFunction(
  {
    id: 'nexus-brivo-events-sync',
    name: 'Nexus: Brivo door events (hourly, keep 30 days)',
    retries: 1,
    concurrency: { limit: 1 },
    timeouts: { finish: '900s' },
    triggers: [{ cron: '17 * * * *' }, { event: 'brivo-events/sync' }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ step }: any) => {
    const sites: string[] = await step.run('list-sites', () => sitesWithBrivo())
    const results = []
    for (const siteId of sites) {
      results.push(await step.run(`sync-${siteId}`, () => syncSite(siteId)))
    }
    const pruned = await step.run('prune-30-days', () => pruneOld())
    const failed = results.filter(r => r.error)
    if (failed.length) console.error('[brivo-events-sync]', failed.slice(0, 10))
    return { sites: sites.length, read: results.reduce((s, r) => s + r.read, 0), failed: failed.length, prune_error: pruned.error }
  },
)
