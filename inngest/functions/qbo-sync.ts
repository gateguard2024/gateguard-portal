// QuickBooks sync: every 15 minutes, and right away when QuickBooks reports a
// change (webhook → 'qbo/changed') or Nexus records a payment ('qbo/sync.now').
// Pulls QuickBooks changes always; sends Nexus invoices/payments/commission bills
// only when auto-sync is on (QuickBooks page → Settings). See lib/qbo-sync.ts.
import { inngest } from '@/inngest/client'
import { runSync } from '@/lib/qbo-sync'

export const qboSync = inngest.createFunction(
  {
    id: 'nexus-qbo-sync',
    name: 'Nexus: QuickBooks sync',
    retries: 1,
    concurrency: { limit: 1 },
    triggers: [
      { cron: '*/15 * * * *' },
      { event: 'qbo/changed' },
      { event: 'qbo/sync.now' },
    ],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ step }: any) => {
    const r = await step.run('sync', () => runSync({ budgetMs: 240000 }))
    // Not connected / already running are normal — nothing to retry.
    if (!r.ok && !r.skipped) throw new Error(r.error ?? 'QuickBooks sync failed')
    return r
  },
)
