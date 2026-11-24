/**
 * lib/gate-reset.ts — run a gate reset recipe (gate_reboots) on the SERVER, so it
 * finishes even if the person closes the page (Nov 24 2026). Gate Guard sets the
 * recipe in Nexus (corporate only); the property portal can only press Reset.
 *
 * Steps: power relay OFF for wait_seconds — sent with a Shelly timer, so the relay
 * turns itself back ON even if we never come back — then ON, then watch the power
 * relay's meter; the moment the operator draws >= draw_watts, open the gate (Brivo
 * activate or a pulse on the 2nd relay). No meter / no draw within sense_seconds →
 * "open by hand". Each run is ONE site_events row (event_type 'gate_reset') whose
 * metadata.phase / log the portal polls.
 */
import { createClient } from '@supabase/supabase-js'
import { controlSiteShellyRelay, readSiteShellyPower } from '@/lib/shelly'
import { getSiteBrivoToken, unlockBrivoDoor } from '@/lib/brivo'

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export type Recipe = {
  id: string; site_id: string; name: string; camera_id: string | null; camera_name: string | null
  power_device_id: string; power_channel: number; power_relay_name: string | null; wait_seconds: number
  actuation_type: 'brivo' | 'shelly' | 'none'; actuation_door_id: string | null; actuation_door_name: string | null
  actuation_device_id: string | null; actuation_channel: number | null; actuation_pulse_seconds: number | null
  portal_door_id?: string | null; portal_enabled?: boolean | null; draw_watts?: number | null; sense_seconds?: number | null
}
export const DEFAULT_DRAW_WATTS = 3
export const DEFAULT_SENSE_SECONDS = 90
export const drawWatts = (r: Recipe) => Number(r.draw_watts) > 0 ? Number(r.draw_watts) : DEFAULT_DRAW_WATTS
export const senseSeconds = (r: Recipe) => Math.min(300, Math.max(15, Number(r.sense_seconds) || DEFAULT_SENSE_SECONDS))
export const waitSeconds = (r: Recipe) => Math.min(600, Math.max(5, Number(r.wait_seconds) || 20))

export type Phase = 'starting' | 'power_off' | 'power_on' | 'sensing' | 'opening' | 'done' | 'open_by_hand' | 'failed'
export type RunState = { phase: Phase; recipe_id: string; recipe: string; by: string; log: { at: string; text: string }[]; watts?: number | null; error?: string; finished?: boolean }

export async function getRecipe(siteId: string, id: string): Promise<Recipe | null> {
  const { data } = await db().from('gate_reboots').select('*').eq('id', id).eq('site_id', siteId).maybeSingle()
  return (data as Recipe) ?? null
}

/** Start a run: one site_events row, returned id = the run id. */
export async function createRun(siteId: string, r: Recipe, by: string, via: string): Promise<string> {
  const state: RunState = { phase: 'starting', recipe_id: r.id, recipe: r.name, by, log: [{ at: new Date().toISOString(), text: `Reset started by ${by}` }] }
  const { data, error } = await db().from('site_events').insert({
    site_id: siteId, event_type: 'gate_reset', event_source: 'shelly',
    title: `Gate reset: ${r.name}`, description: `Gate reset started by ${by} (${via})`, summary: `Gate reset · ${by}`,
    metadata: { ...state, via },
  }).select('id').single()
  if (error || !data) throw new Error(error?.message ?? 'Could not start the reset')
  return String(data.id)
}

export async function readRun(siteId: string, runId: string): Promise<RunState | null> {
  const { data } = await db().from('site_events').select('metadata').eq('id', runId).eq('site_id', siteId).eq('event_type', 'gate_reset').maybeSingle()
  return (data?.metadata as RunState) ?? null
}

async function update(runId: string, patch: Partial<RunState>, line?: string) {
  const { data } = await db().from('site_events').select('metadata').eq('id', runId).maybeSingle()
  const cur = (data?.metadata ?? {}) as RunState
  const log = line ? [...(cur.log ?? []), { at: new Date().toISOString(), text: line }] : cur.log
  const { error } = await db().from('site_events').update({ metadata: { ...cur, ...patch, log } }).eq('id', runId)
  if (error) console.error('[gate-reset] update failed:', error.message)
}

/** Step: power off (Shelly timer brings it back on by itself after wait_seconds). */
export async function stepPowerOff(runId: string, r: Recipe) {
  const w = waitSeconds(r)
  await controlSiteShellyRelay(r.site_id, r.power_device_id, r.power_channel, false, w)
  await update(runId, { phase: 'power_off' }, `Power off for ${w} s`)
}

/** Step: make sure power is on again. */
export async function stepPowerOn(runId: string, r: Recipe) {
  await controlSiteShellyRelay(r.site_id, r.power_device_id, r.power_channel, true)
  if (r.actuation_type === 'none') { await update(runId, { phase: 'done', finished: true }, 'Power back on — done'); return 'done' as const }
  await update(runId, { phase: 'sensing' }, 'Power back on — waiting for the operator to draw current')
  return 'sense' as const
}

/** Step: watch the meter for up to `forMs`. → 'draw' | 'no_meter' | 'waiting' */
export async function stepSense(runId: string, r: Recipe, forMs: number): Promise<'draw' | 'no_meter' | 'waiting'> {
  const until = Date.now() + forMs, need = drawWatts(r)
  while (Date.now() < until) {
    let p: Awaited<ReturnType<typeof readSiteShellyPower>>
    try { p = await readSiteShellyPower(r.site_id, r.power_device_id, r.power_channel) }
    catch { await update(runId, { phase: 'open_by_hand', finished: true }, 'Couldn’t read the relay’s power — open the gate by hand when it’s up on camera'); return 'no_meter' }
    if (!p.metered) { await update(runId, { phase: 'open_by_hand', finished: true }, 'This relay doesn’t measure power — open the gate by hand when it’s up on camera'); return 'no_meter' }
    const watts = p.watts ?? (p.amps != null ? p.amps * 120 : null)
    if (watts != null && watts >= need) { await update(runId, { watts }, `Operator drawing ${Math.round(watts)} W`); return 'draw' }
    await update(runId, { watts })
    await new Promise(res => setTimeout(res, 1500))
  }
  return 'waiting'
}

/** Step: open the gate. */
export async function stepOpen(runId: string, r: Recipe) {
  await update(runId, { phase: 'opening' }, 'Opening the gate')
  if (r.actuation_type === 'brivo' && r.actuation_door_id) {
    const { token, apiKey, credentialValue } = await getSiteBrivoToken(r.site_id)
    await unlockBrivoDoor(token, apiKey, r.actuation_door_id, credentialValue)
  } else if (r.actuation_type === 'shelly' && r.actuation_device_id) {
    await controlSiteShellyRelay(r.site_id, r.actuation_device_id, r.actuation_channel ?? 0, true, Math.max(1, Math.min(10, Number(r.actuation_pulse_seconds) || 1)))
  }
  await update(runId, { phase: 'done', finished: true }, 'Gate opened — reset done')
}

export async function stepGiveUp(runId: string, r: Recipe) {
  await update(runId, { phase: 'open_by_hand', finished: true }, `No current seen in ${senseSeconds(r)} s — check the camera, then open the gate by hand`)
}
export async function stepFailed(runId: string, msg: string) {
  await update(runId, { phase: 'failed', finished: true, error: msg }, `Stopped: ${msg}`)
}
