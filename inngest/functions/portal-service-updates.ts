// Every 10 min: tell people who made a service request in the property portal when it
// moves (lib/service-updates.ts). One message per change; stops when done.
import { inngest } from '@/inngest/client'
import { sendServiceUpdates } from '@/lib/service-updates'

export const portalServiceUpdates = inngest.createFunction(
  { id: 'nexus-portal-service-updates', name: 'Nexus: property portal service request updates', retries: 1, concurrency: { limit: 1 }, triggers: [{ cron: '*/10 * * * *' }] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ step }: any) => step.run('send', () => sendServiceUpdates()),
)
