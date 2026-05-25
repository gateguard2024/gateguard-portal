// POST /api/incidents/ingest
// Internal webhook — called by GGSOC when an alarm is resolved or a patrol issue is logged.
// Auth: x-ggsoc-secret header must match GGSOC_WEBHOOK_SECRET env var (no Clerk required).
//
// Body shape (alarm):
//   { source: 'soc_alarm', source_id, site_name, een_account_id?, brivo_account_id?,
//     event_type, event_label, priority, operator_name, action_taken, notes }
//
// Body shape (patrol issue):
//   { source: 'soc_patrol', source_id, site_name, een_account_id?, brivo_account_id?,
//     issue_detail, operator_name, patrol_type }

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Map GGSOC P-priority → portal severity
const PRIORITY_MAP: Record<string, string> = {
  P1: 'critical',
  P2: 'high',
  P3: 'medium',
  P4: 'low',
}

// Map GGSOC action_taken → human-readable title suffix
const ACTION_LABELS: Record<string, string> = {
  authorized:                  'Authorized Access',
  unauthorized:                'Unauthorized Access',
  false_alarm:                 'False Alarm',
  police_dispatched:           'Police Dispatched',
  emergency_services_on_site:  'Emergency Services On Site',
  property_violation:          'Property Violation',
  gate_service_needed:         'Gate Service Required',
  door_service_needed:         'Door Service Required',
  other:                       'Incident',
}

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const secret = req.headers.get('x-ggsoc-secret')
  if (!secret || secret !== process.env.GGSOC_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const {
    source,
    source_id,
    site_name,
    een_account_id,
    brivo_account_id,
    // alarm fields
    event_type,
    event_label,
    priority,
    operator_name,
    action_taken,
    notes,
    // patrol fields
    issue_detail,
    patrol_type,
  } = body

  if (!source || !source_id) {
    return NextResponse.json({ error: 'source and source_id are required' }, { status: 400 })
  }

  // ── Site lookup ───────────────────────────────────────────────────────────
  // Try 1: direct EEN account ID on sites table (migration 090)
  // Try 2: EEN account ID on organizations → first site for that org
  // Try 3: Brivo account ID on sites table
  // Try 4: Brivo account ID on organizations → first site for that org
  // Try 5: name match (fuzzy)
  // Fallback: null site_id (incident still created, site_name in description)
  let site_id: string | null = null
  let org_id: string | null = null

  if (een_account_id) {
    // Try sites.een_account_id
    const { data: siteRow } = await supabase
      .from('sites')
      .select('id, org_id')
      .eq('een_account_id', een_account_id)
      .limit(1)
      .single()
    if (siteRow) { site_id = siteRow.id; org_id = siteRow.org_id }

    if (!site_id) {
      // Try organizations.eagleeye_account_id
      const { data: orgRow } = await supabase
        .from('organizations')
        .select('id')
        .eq('eagleeye_account_id', een_account_id)
        .limit(1)
        .single()
      if (orgRow) {
        org_id = orgRow.id
        const { data: siteFallback } = await supabase
          .from('sites')
          .select('id')
          .eq('org_id', orgRow.id)
          .limit(1)
          .single()
        if (siteFallback) site_id = siteFallback.id
      }
    }
  }

  if (!site_id && brivo_account_id) {
    const { data: siteRow } = await supabase
      .from('sites')
      .select('id, org_id')
      .eq('brivo_account_id', brivo_account_id)
      .limit(1)
      .single()
    if (siteRow) { site_id = siteRow.id; org_id = siteRow.org_id }

    if (!site_id) {
      const { data: orgRow } = await supabase
        .from('organizations')
        .select('id')
        .eq('brivo_account_id', brivo_account_id)
        .limit(1)
        .single()
      if (orgRow) {
        org_id = orgRow.id
        const { data: siteFallback } = await supabase
          .from('sites')
          .select('id')
          .eq('org_id', orgRow.id)
          .limit(1)
          .single()
        if (siteFallback) site_id = siteFallback.id
      }
    }
  }

  // Fallback: fuzzy name match
  if (!site_id && site_name) {
    const { data: siteRow } = await supabase
      .from('sites')
      .select('id, org_id')
      .ilike('name', `%${site_name}%`)
      .limit(1)
      .single()
    if (siteRow) { site_id = siteRow.id; org_id = siteRow.org_id }
  }

  // ── Build incident fields ─────────────────────────────────────────────────
  let title = ''
  let description = ''
  let severity = 'medium'

  if (source === 'soc_alarm') {
    const actionLabel = ACTION_LABELS[action_taken] ?? 'Incident'
    title = `[SOC] ${actionLabel} — ${site_name ?? 'Unknown Site'}`
    const lines = [
      `Event: ${event_label ?? event_type ?? 'Unknown Event'}`,
      `Priority: ${priority ?? 'P3'}`,
      `Operator: ${operator_name ?? 'SOC'}`,
      `Action: ${ACTION_LABELS[action_taken] ?? action_taken ?? 'N/A'}`,
    ]
    if (notes) lines.push(`Notes: ${notes}`)
    description = lines.join('\n')
    severity = PRIORITY_MAP[priority] ?? 'medium'
  } else if (source === 'soc_patrol') {
    title = `[Patrol] Issue at ${site_name ?? 'Unknown Site'}`
    const lines = [
      `Patrol: ${patrol_type ?? 'Virtual Patrol'}`,
      `Operator: ${operator_name ?? 'SOC'}`,
    ]
    if (issue_detail) lines.push(`Issue: ${issue_detail}`)
    description = lines.join('\n')
    severity = 'medium'
  }

  // ── Insert incident (ON CONFLICT DO NOTHING for idempotency) ─────────────
  const { data: incident, error } = await supabase
    .from('incidents')
    .insert({
      org_id:         org_id ?? null,
      site_id:        site_id ?? null,
      title,
      description,
      severity,
      status:         'open',
      reported_by:    operator_name ?? 'GGSOC',
      source,
      source_id,
      soc_event_type: event_type ?? null,
      soc_priority:   priority ?? null,
      soc_operator:   operator_name ?? null,
      soc_action:     action_taken ?? null,
    })
    .select()
    .single()

  if (error) {
    // Duplicate source_id — already ingested, return 200 silently
    if (error.code === '23505') {
      return NextResponse.json({ ok: true, duplicate: true })
    }
    console.error('[incidents/ingest] insert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, incident_id: incident.id, site_matched: !!site_id })
}
