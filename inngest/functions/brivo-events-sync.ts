// Brivo door events → our database, every 15 min (lib/brivo-events-store.ts, migrations 241 + 243).
// Each active property with a Brivo login gets its own step (a failure at one property
// doesn't stop the rest; it carries on next run). Each run has a Brivo call budget and
// uses the slow background lane — the last 30 days fill in over a few runs, never in
// one burst (Nov 24 2026: one burst got the Brivo key throttled). NO retries: a retry
// is another burst. Events older than 90 days are deleted.
// Also runs on "brivo-events/sync" for an immediate pass.
import { inngest } from '@/inngest/client'
import { sitesWithBrivo, syncSite, pruneOld } from '@/lib/brivo-events-store'

export const brivoEventsSync = inngest.createFunction(
  {
    id: 'nexus-brivo-events-sync',
    name: 'Nexus: Brivo door events (every 15 min, keep 90 days)',
    retries: 0,
    concurrency: { limit: 1 },
    timeouts: { finish: '900s' },
    triggers: [{ cron: '2,17,32,47 * * * *' }, { event: 'brivo-events/sync' }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ step }: any) => {
    const sites: string[] = await step.run('list-sites', () => sitesWithBrivo())
    const results = []
    for (const siteId of sites) {
      results.push(await step.run(`sync-${siteId}`, () => syncSite(siteId)))
    }
    const pruned = await step.run('prune-90-days', () => pruneOld())
    const failed = results.filter(r => r.error)
    if (failed.length) console.error('[brivo-events-sync]', failed.slice(0, 10))
    return { sites: sites.length, read: results.reduce((s, r) => s + r.read, 0), saved: results.reduce((s, r) => s + r.saved, 0), failed: failed.length, prune_error: pruned.error }
  },
)
