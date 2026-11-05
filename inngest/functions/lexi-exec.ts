// Executive Lexi (lib/lexi/exec.ts), for the people in LEXI_EXEC_EMAILS.
//   Weekdays 5:41am Eastern  → market watch scan, then the day's plans (90%+ only),
//                               ready before the 6:30 morning brief email picks them up.
//   Weekdays every 2 hours, 8am–6pm Eastern → "as things come up": new big signals
//                               (big deal gone quiet, serious system problem, urgent job late)
//                               → a focused plan. At most 4 of these runs a day.
//   Mondays (daily run)  → last week's auto Scorecard numbers.
//   Event "lexi/exec.run" { mode: 'daily' | 'signals' } runs one on demand.
// lexiExecBriefs: weekdays 8:00am, 12:00pm, 5:00pm Eastern → a brief (saved as a Lexi chat + emailed).
import { inngest } from '@/inngest/client'
import { checkSignals, execUsers, fillScorecard, runExecBrief, runMarketScan, runStrategist, slotForHour, type BriefSlot } from '@/lib/lexi/exec'

export const lexiExec = inngest.createFunction(
  {
    id: 'nexus-lexi-exec',
    name: 'Nexus: Executive Lexi',
    retries: 1,
    concurrency: { limit: 1 },
    timeouts: { finish: '600s' },
    triggers: [
      { cron: 'TZ=America/New_York 41 5 * * 1-5' },
      { cron: 'TZ=America/New_York 7 8-18/2 * * 1-5' },
      { event: 'lexi/exec.run' },
    ],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const hourET = Number(new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }))
    const mode: 'daily' | 'signals' = event?.data?.mode === 'daily' || event?.data?.mode === 'signals' ? event.data.mode : hourET < 7 ? 'daily' : 'signals'

    const market = mode === 'daily' ? await step.run('market-watch', () => runMarketScan()) : null
    const ids: string[] = await step.run('who', async () => (await execUsers()).map(u => u.id))
    const results: Record<string, unknown> = {}
    for (const id of ids) {
      results[id] = await step.run(`${mode}-${id}`, async () => {
        const u = (await execUsers()).find(x => x.id === id)
        if (!u) return 'skipped: not found'
        if (mode !== 'daily') return checkSignals(u)
        const monday = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short' }) === 'Mon'
        const scorecard = monday ? await fillScorecard(u).catch(e => ({ error: String(e) })) : null
        return { plans: await runStrategist(u, { source: 'daily', maxPlans: 3 }), scorecard }
      })
    }
    return { mode, market, users: ids.length, results }
  },
)

export const lexiExecBriefs = inngest.createFunction(
  {
    id: 'nexus-lexi-exec-briefs',
    name: 'Nexus: Executive Lexi briefs (8 · 12 · 5)',
    retries: 2,
    concurrency: { limit: 1 },
    timeouts: { finish: '300s' },
    triggers: [
      { cron: 'TZ=America/New_York 0 8 * * 1-5' },
      { cron: 'TZ=America/New_York 0 12 * * 1-5' },
      { cron: 'TZ=America/New_York 0 17 * * 1-5' },
      { event: 'lexi/exec.brief' },
    ],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const hourET = Number(new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }))
    const asked = event?.data?.slot
    const slot: BriefSlot = asked === 'morning' || asked === 'lunch' || asked === 'evening' ? asked : slotForHour(hourET)
    const ids: string[] = await step.run('who', async () => (await execUsers()).map(u => u.id))
    const results: Record<string, unknown> = {}
    for (const id of ids) {
      results[id] = await step.run(`${slot}-${id}`, async () => {
        const u = (await execUsers()).find(x => x.id === id)
        if (!u) return 'skipped: not found'
        const r = await runExecBrief(u, slot)
        if (!r.ok) throw new Error(r.error ?? 'brief failed') // retried; already-sent briefs are skipped
        return r
      })
    }
    return { slot, users: ids.length, results }
  },
)
