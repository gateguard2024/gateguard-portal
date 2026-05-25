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
 * Inbound alarm bridge from GGSOC (gateguard-dispatch-ui).
 * Auth: x-ggsoc-secret header must match GGSOC_INGEST_SECRET env var.
 * If GGSOC_INGEST_SECRET is not set, the request is allowed through with a
 * warning log (development / staging convenience).
 *
 * Body shape:
 *   alarm_type    string   — e.g. "gate_offline", "motion_detected", "access_denied"
 *   severity      string   — "low" | "medium" | "high" | "critical"
 *   property_name string   — human-readable property label
 *   site_id?      string   — UUID of the matching sites row (optional)
 *   description?  string   — free-form detail
 *   source        string   — originating system, e.g. "GGSOC", "brivo", "eagle_eye"
 *   triggered_by? string   — operator name / system identifier that fired the alarm
 */
export async function POST(req: NextRequest) {
  // ── Auth check ────────────────────────────────────────────────────────────
  const secret = process.env.GGSOC_INGEST_SECRET

  if (secret) {
    const provided = req.headers.get('x-ggsoc-secret')
    if (provided !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else {
    // No secret configured — allow but warn so ops can't miss it in logs
    console.warn(
      '[incidents/ingest] GGSOC_INGEST_SECRET is not set. ' +
        'Request accepted without auth — set this env var in production.'
    )
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: {
    alarm_type: string
    severity?: string
    property_name?: string
    site_id?: string
    description?: string
    source?: string
    triggered_by?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { alarm_type, severity, property_name, site_id, description, source, triggered_by } = body

  if (!alarm_type) {
    return NextResponse.json({ error: 'alarm_type is required' }, { status: 400 })
  }

  // ── Map alarm fields → incidents schema ──────────────────────────────────
  const validSeverities = ['low', 'medium', 'high', 'critical'] as const
  type Severity = (typeof validSeverities)[number]

  const resolvedSeverity: Severity = validSeverities.includes(severity as Severity)
    ? (severity as Severity)
    : 'medium'

  const titleParts: string[] = []
  titleParts.push(alarm_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
  if (property_name) titleParts.push(`— ${property_name}`)
  const title = titleParts.join(' ')

  const reportedByParts: string[] = []
  if (source) reportedByParts.push(source)
  if (triggered_by) reportedByParts.push(triggered_by)
  const reported_by = reportedByParts.join(' / ') || 'GGSOC'

  // ── Write to Supabase ─────────────────────────────────────────────────────
  const { data, error } = await supabase
    .from('incidents')
    .insert({
      site_id:     site_id ?? null,
      org_id:      null,
      title,
      description: description ?? null,
      severity:    resolvedSeverity,
      status:      'open',
      reported_by,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[incidents/ingest] Supabase insert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ id: data.id, success: true }, { status: 201 })
}
