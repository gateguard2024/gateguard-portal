/**
 * lib/ggsocBridge.ts
 *
 * Helper for the GGSOC app (gateguard-dispatch-ui) to push alarms into the
 * GateGuard Portal incidents table via the /api/incidents/ingest webhook.
 *
 * USAGE IN GGSOC:
 *   import { pushAlarmToPortal } from '@/lib/ggsocBridge'
 *
 *   await pushAlarmToPortal({
 *     alarm_type:    'gate_offline',
 *     severity:      'high',
 *     property_name: 'Sunset Commons',
 *     site_id:       'uuid-of-the-site',      // optional
 *     description:   'Gate 1 lost heartbeat', // optional
 *     source:        'GGSOC',
 *     triggered_by:  'operator@gateguard.co', // optional
 *   })
 *
 * ENV VARS REQUIRED (in GGSOC):
 *   PORTAL_URL           — e.g. https://portal.gateguard.co
 *   GGSOC_INGEST_SECRET  — shared secret; must match the value set in the Portal
 *
 * ENDPOINT:
 *   POST https://portal.gateguard.co/api/incidents/ingest
 *   Header: x-ggsoc-secret: <GGSOC_INGEST_SECRET>
 *   Content-Type: application/json
 *
 * RESPONSE (201 on success):
 *   { id: "uuid-of-new-incident", success: true }
 *
 * FIELD MAPPING (ingest body → incidents table):
 *   alarm_type + property_name  → title   ("Gate Offline — Sunset Commons")
 *   severity                    → severity (low | medium | high | critical; default "medium")
 *   description                 → description
 *   source + triggered_by       → reported_by ("GGSOC / operator@gateguard.co")
 *   site_id                     → site_id (UUID FK to sites table, optional)
 *
 * SEVERITY VALUES:
 *   "critical" — system down, safety risk, immediate response required
 *   "high"     — degraded service, action needed soon
 *   "medium"   — warning-level, monitor and schedule follow-up
 *   "low"      — informational, no immediate action
 */

export interface GGSOCAlarm {
  /** Machine-readable alarm category, e.g. "gate_offline", "motion_detected", "access_denied" */
  alarm_type: string
  /** Incident severity. Defaults to "medium" if omitted. */
  severity?: 'low' | 'medium' | 'high' | 'critical'
  /** Human-readable property name, appended to the title. */
  property_name?: string
  /** UUID of the matching sites row in the Portal (optional but recommended for drill-down). */
  site_id?: string
  /** Free-form description of the alarm. */
  description?: string
  /** Source system identifier, e.g. "GGSOC", "brivo", "eagle_eye". */
  source?: string
  /** Operator name or system identifier that triggered the alarm. */
  triggered_by?: string
}

export interface GGSOCAlarmResult {
  id: string
  success: true
}

/**
 * Push an alarm from GGSOC into the Portal incidents table.
 *
 * Throws if the network request fails or the Portal returns a non-2xx status.
 * Callers should wrap in try/catch and decide whether to retry or swallow.
 */
export async function pushAlarmToPortal(alarm: GGSOCAlarm): Promise<GGSOCAlarmResult> {
  const portalUrl = process.env.PORTAL_URL ?? 'https://portal.gateguard.co'
  const secret    = process.env.GGSOC_INGEST_SECRET ?? ''

  const res = await fetch(`${portalUrl}/api/incidents/ingest`, {
    method:  'POST',
    headers: {
      'Content-Type':    'application/json',
      'x-ggsoc-secret': secret,
    },
    body: JSON.stringify(alarm),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`[ggsocBridge] Portal ingest failed (${res.status}): ${text}`)
  }

  return res.json() as Promise<GGSOCAlarmResult>
}
