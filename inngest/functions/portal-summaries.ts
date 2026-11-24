// Property portal emailed summaries (lib/activity-summary.ts): daily ones every morning
// at 7:12 ET, weekly ones on Mondays. Only managers who turned it on (Activity page).
import { inngest } from '@/inngest/client'
import { sendSummaries } from '@/lib/activity-summary'

export const portalSummaries = inngest.createFunction(
  { id: 'nexus-portal-summaries', name: 'Nexus: property portal activity summaries', retries: 1, concurrency: { limit: 1 }, triggers: [{ cron: 'TZ=America/New_York 12 7 * * *' }] },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ step }: any) => {
    const daily = await step.run('daily', () => sendSummaries('daily'))
    const monday = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short' }) === 'Mon'
    const weekly = monday ? await step.run('weekly', () => sendSummaries('weekly')) : null
    return { daily, weekly }
  },
)
