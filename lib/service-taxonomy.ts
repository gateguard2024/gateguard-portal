/**
 * What a service job was — the codes every job is closed with (migration 235), so
 * calls can be counted and compared (Operations Hub → Analytics → Service insight).
 * Decided Nov 19 2026:
 *  - visit type, what we worked on and the fix are REQUIRED on every job;
 *  - the cause is required only for repair-type visits (repair, damage, emergency, warranty);
 *  - a remote reset needs remote minutes instead of time on site;
 *  - "Bill the property" only marks the job Ready for billing (billing/admin section = later).
 * Safe to import from client and server.
 */
const o = <T extends string>(id: T, label: string) => ({ id, label })

export const VISIT_TYPES = [
  o('pm', 'Preventive maintenance'),
  o('repair', 'Repair'),
  o('damage', 'Damage repair'),
  o('emergency', 'Emergency / after-hours'),
  o('warranty', 'Warranty'),
  o('install', 'Install / add-on'),
  o('inspection', 'Inspection'),
  o('training', 'Training'),
  o('removal', 'Removal'),
] as const

export const SYSTEMS = [
  o('gate_operator', 'Gate operator'),
  o('gate_arm', 'Gate arm / barrier'),
  o('gate_hardware', 'Gate itself (hinges, rollers, track, panel)'),
  o('safety', 'Loops / photo eyes / safety'),
  o('access', 'Access control (reader, keypad, controller)'),
  o('intercom', 'Intercom / call box'),
  o('camera', 'Camera / NVR'),
  o('network', 'Network / power'),
  o('door', 'Door lock / hardware'),
  o('other', 'Other'),
] as const

export const CAUSES = [
  o('wear', 'Wear and tear'),
  o('vehicle', 'Hit by a vehicle'),
  o('abuse', 'Vandalism / abuse'),
  o('weather', 'Weather / water / lightning'),
  o('power', 'Power problem'),
  o('install', 'Install / workmanship'),
  o('settings', 'Programming / settings'),
  o('user_error', 'Resident or staff error'),
  o('debris', 'Debris / pests'),
  o('no_fault', 'No fault found'),
] as const

export const RESOLUTIONS = [
  o('remote_reset', 'Remote reset (no truck roll)'),
  o('adjusted', 'Adjusted / reprogrammed'),
  o('repaired', 'Repaired'),
  o('replaced_part', 'Replaced a part'),
  o('replaced_unit', 'Replaced the unit'),
  o('cleaned', 'Cleaned / cleared'),
  o('temporary', 'Temporary fix — needs a return'),
  o('needs_quote', 'Couldn’t fix — needs a quote'),
] as const

export const BILL_TO = [
  o('plan', 'Service plan'),
  o('property', 'Bill the property'),
  o('warranty', 'Warranty claim'),
] as const

export type VisitType = (typeof VISIT_TYPES)[number]['id']
export type SystemId = (typeof SYSTEMS)[number]['id']
export type CauseId = (typeof CAUSES)[number]['id']
export type ResolutionId = (typeof RESOLUTIONS)[number]['id']
export type BillTo = (typeof BILL_TO)[number]['id']

export type ServiceDetails = {
  visit_type: VisitType | null; system: SystemId | null; system_2: SystemId | null
  cause: CauseId | null; resolution: ResolutionId | null; bill_to: BillTo | null; remote_minutes: number | null
}
export const DETAIL_KEYS = ['visit_type', 'system', 'system_2', 'cause', 'resolution', 'bill_to', 'remote_minutes'] as const

const LISTS: Record<string, readonly { id: string; label: string }[]> = { visit_type: VISIT_TYPES, system: SYSTEMS, system_2: SYSTEMS, cause: CAUSES, resolution: RESOLUTIONS, bill_to: BILL_TO }
export const labelOf = (field: string, id: string | null | undefined) => (id ? LISTS[field]?.find((x) => x.id === id)?.label ?? id : '—')

/** Repair-type visits need a cause. */
export const NEEDS_CAUSE: ReadonlySet<string> = new Set(['repair', 'damage', 'emergency', 'warranty'])
/** Causes where the property usually pays. */
export const BILLABLE_CAUSES: ReadonlySet<string> = new Set(['vehicle', 'abuse', 'user_error'])
export const isRemote = (d: Partial<ServiceDetails>) => d.resolution === 'remote_reset'

/** Clean a body → only known codes (unknown values dropped, '' / null clears). */
export function cleanDetails(body: Record<string, unknown>): Partial<ServiceDetails> {
  const out: Record<string, unknown> = {}
  for (const k of DETAIL_KEYS) {
    if (!(k in body)) continue
    const v = body[k]
    if (k === 'remote_minutes') { const n = v === null || v === '' ? null : Math.round(Number(v)); out[k] = n == null || !isFinite(n) ? null : Math.max(0, Math.min(1440, n)); continue }
    if (v === null || v === '') { out[k] = null; continue }
    if (LISTS[k].some((x) => x.id === v)) out[k] = v
  }
  return out as Partial<ServiceDetails>
}

/** What's still missing. */
export function detailsMissing(d: Partial<ServiceDetails>): ('visit_type' | 'system' | 'cause' | 'resolution' | 'remote_minutes')[] {
  const m: ('visit_type' | 'system' | 'cause' | 'resolution' | 'remote_minutes')[] = []
  if (!d.visit_type) m.push('visit_type')
  if (!d.system) m.push('system')
  if (d.visit_type && NEEDS_CAUSE.has(d.visit_type) && !d.cause) m.push('cause')
  if (!d.resolution) m.push('resolution')
  if (isRemote(d) && !(Number(d.remote_minutes) > 0)) m.push('remote_minutes')
  return m
}

/** A starting guess for a new close-out (never saved until someone confirms). */
export function guessVisitType(job: { job_type?: string | null; title?: string | null }): VisitType | null {
  const t = `${job.job_type ?? ''} ${job.title ?? ''}`.toLowerCase()
  if (/\bpm\b|prevent|quarterly|maintenance plan|inspection due/.test(t)) return 'pm'
  if (/install|add[- ]on/.test(t)) return 'install'
  if (/inspect|survey/.test(t)) return 'inspection'
  if (/removal|decommission/.test(t)) return 'removal'
  if (/gate left open|stuck|broken|not working|repair|fix|down/.test(t)) return 'repair'
  return null
}
