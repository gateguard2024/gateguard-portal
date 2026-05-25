import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/incidents/ingest
 *
 * Accepts alarms from GGSOC (gateguard-dispatch-ui) in either payload shape:
 *
 * GGSOC shape (from lib/portalIngest.ts):
 *   source          'soc_alarm' | 'soc_patrol'
 *   source_id       string
 *   incident_status 'open' | 'resolved'
 *   site_name       string
 *   event_type?     string
 *   priority?       'P1' | 'P2' | 'P3' | 'P4'
 *   operator_name?  string
 *   action_taken?   string
 *   notes?          string
 *   issue_detail?   string   (patrol only)
 *
 * Direct shape:
 *   alarm_type      string   required
 *   severity        'low' | 'medium' | 'high' | 'critical'
 *   property_name   string
 *   site_id?        uuid
 *   description?    string
 *   source?         string
 *   triggered_by?   string
 *
 * Auth: x-ggsoc-secret header must match GGSOC_INGEST_SECRET env var.
 */
export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const secret = process.env.GGSOC_INGEST_SECRET
  if (secret) {
    const provided = req.headers.get('x-ggsoc-secret')
    if (provided !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else {
    console.warn('[incidents/ingest] GGSOC_INGEST_SECRET not set — accepting without auth')
  }

  // ── Parse ─────────────────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // ── Normalise GGSOC vs direct payload shape ───────────────────────────────
  const isGgsocShape = body.source === 'soc_alarm' || body.source === 'soc_patrol'

  // alarm_type / title seed
  const alarmType: string = String(
    isGgsocShape
      ? (body.event_type ?? body.source ?? 'alarm')
      : (body.alarm_type ?? body.event_type ?? 'alarm')
  )

  // property name
  const propertyName: string | undefined = String(
    isGgsocShape ? (body.site_name ?? '') : (body.property_name ?? '')
  ) || undefined

  // severity — map P1-P4 to severity levels, fall back to direct severity field
  const priorityMap: Record<string, string> = { P1: 'critical', P2: 'high', P3: 'medium', P4: 'low' }
  const rawSev = isGgsocShape
    ? (priorityMap[body.priority as string] ?? 'high')
    : String(body.severity ?? 'medium')

  const validSeverities = ['low', 'medium', 'high', 'critical'] as const
  type Severity = (typeof validSeverities)[number]
  const severity: Severity = validSeverities.includes(rawSev as Severity)
    ? (rawSev as Severity)
    : 'medium'

  // status
  const status = (body.incident_status === 'resolved' || body.status === 'resolved')
    ? 'resolved' : 'open'

  // site_id (only meaningful in direct shape — GGSOC doesn't know portal UUIDs)
  const siteId = (body.site_id as string | undefined) ?? null

  // description
  const descParts: string[] = []
  if (body.event_label)  descParts.push(String(body.event_label))
  if (body.action_taken) descParts.push(`Action: ${body.action_taken}`)
  if (body.notes)        descParts.push(String(body.notes))
  if (body.issue_detail) descParts.push(String(body.issue_detail))
  if (body.description)  descParts.push(String(body.description))
  const description = descParts.join(' · ') || null

  // reported_by
  const sourceName = isGgsocShape
    ? (body.source === 'soc_patrol' ? 'GGSOC Patrol' : 'GGSOC')
    : String(body.source ?? 'GGSOC')
  const operatorName = (body.operator_name ?? body.triggered_by) as string | undefined
  const reportedBy = operatorName ? `${sourceName} / ${operatorName}` : sourceName

  // title
  const titleBase = alarmType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const title = propertyName ? `${titleBase} — ${propertyName}` : titleBase

  // ── Write to Supabase ─────────────────────────────────────────────────────
  const { data, error } = await supabase
    .from('incidents')
    .insert({
      org_id:      null,
      site_id:     siteId,
      title,
      description,
      severity,
      status,
      reported_by: reportedBy,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[incidents/ingest] Supabase insert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ id: data.id, success: true }, { status: 201 })
}
