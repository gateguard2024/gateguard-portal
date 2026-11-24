// Gate reset run (lib/gate-reset.ts) — started from the property portal (or Nexus) with
// event "gate/reset.run" { siteId, recipeId, runId }. Runs on the server: power off with a
// Shelly timer (comes back on by itself), sleep, power on, watch the draw in short steps,
// open the gate. One run per gate at a time.
import { inngest } from '@/inngest/client'
import { getRecipe, stepPowerOff, stepPowerOn, stepSense, stepOpen, stepGiveUp, stepFailed, waitSeconds, senseSeconds } from '@/lib/gate-reset'

export const gateReset = inngest.createFunction(
  {
    id: 'nexus-gate-reset',
    name: 'Nexus: gate reset (power cycle, open when the operator draws current)',
    retries: 0,
    concurrency: { limit: 1, key: 'event.data.recipeId' },
    timeouts: { finish: '900s' },
    triggers: [{ event: 'gate/reset.run' }],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async ({ event, step }: any) => {
    const { siteId, recipeId, runId } = event.data as { siteId: string; recipeId: string; runId: string }
    const r = await step.run('recipe', () => getRecipe(siteId, recipeId))
    if (!r) { await step.run('no-recipe', () => stepFailed(runId, 'That reset recipe no longer exists')); return { ok: false } }
    try {
      await step.run('power-off', () => stepPowerOff(runId, r))
      await step.sleep('wait-off', `${waitSeconds(r)}s`)
      const next = await step.run('power-on', () => stepPowerOn(runId, r))
      if (next === 'done') return { ok: true }
      const chunks = Math.ceil(senseSeconds(r) / 8)
      for (let i = 0; i < chunks; i++) {
        const res = await step.run(`sense-${i}`, () => stepSense(runId, r, 8000))
        if (res === 'no_meter') return { ok: true, manual: true }
        if (res === 'draw') { await step.run('open', () => stepOpen(runId, r)); return { ok: true } }
      }
      await step.run('give-up', () => stepGiveUp(runId, r))
      return { ok: true, manual: true }
    } catch (e) {
      await step.run('failed', () => stepFailed(runId, e instanceof Error ? e.message : String(e)))
      return { ok: false }
    }
  },
)
