// POST /api/incidents/ingest
// Internal webhook — called by GGSOC on alarm creation, alarm resolution,
// patrol alarm creation, and patrol completion.
// Auth: x-ggsoc-secret header must match GGSOC_WEBHOOK_SECRET env var (no Clerk required).
//
// Body — alarm created:
//   { source:'soc_alarm', source_id, site_name, een_account_id?,
//     event_type, event_label, priority, operator_name, incident_status:'open' }
//
// Body — alarm resolved:
//   { source:'soc_alarm', source_id, site_name, een_account_id?,
//     event_type, event_label, priority, operator_name, action_taken, notes,
//     incident_status:'resolved' }
//
// Body — patrol issue (created on patrol raise OR patrol submit):
//   { source:'soc_patrol', source_id, site_name, een_account_id?,
//     issue_detail, operator_name, patrol_type, incident_status:'open'|'resolved' }
//
// Upsert behaviour:
//   First call with a source_id  → INSERT new incident
//   Later call with same source_id → UPDATE status + add resolution fields

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PRIORITY_MAP: Record<string, string> = {
  P1: 'critical',
  P2: 'high',
  P3: 'medium',
  P4: 'low',
}

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
    source,           // 'soc_alarm' | 'soc_patrol'
    source_id,        // alarm.id  OR  patrolLogId::accountId
    incident_status,  // 'open' | 'resolved' — what state to set/update
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

  const portalStatus = incident_status === 'resolved' ? 'resolved' : 'open'

  // ── Check if this source_id already exists → UPDATE path ─────────────────
  const { data: existing } = await supabase
    .from('incidents')
    .select('id, title, description')
    .eq('source_id', source_id)
    .single()

  if (existing) {
    // Update the incident: status + resolution details appended to description
    const resolutionNote = action_taken
      ? `\n—\nResolved by: ${operator_name ?? 'SOC'}\nAction: ${ACTION_LABELS[action_taken] ?? action_taken}${notes ? `\nNotes: ${notes}` : ''}`
      : ''

    await supabase
      .from('incidents')
      .update({
        status:       portalStatus,
        soc_action:   action_taken ?? null,
        soc_operator: operator_name ?? null,
        description:  resolutionNote
          ? `${existing.description ?? ''}${resolutionNote}`
          : existing.description,
        resolved_at:  portalStatus === 'resolved' ? new Date().toISOString() : null,
        updated_at:   new Date().toISOString(),
      })
      .eq('id', existing.id)

    return NextResponse.json({ ok: true, incident_id: existing.id, updated: true })
  }

  // ── Site lookup ───────────────────────────────────────────────────────────
  // Cascade: sites.een_account_id → orgs.eagleeye_account_id → sites.brivo_account_id
  //        → orgs.brivo_account_id → name ILIKE
  let site_id: string | null = null
  let org_id: string | null  = null

  async function tryEen(id: string) {
    const { data } = await supabase.from('sites').select('id, org_id').eq('een_account_id', id).limit(1).single()
    if (data) { site_id = data.id; org_id = data.org_id; return true }
    const { data: org } = await supabase.from('organizations').select('id').eq('eagleeye_account_id', id).limit(1).single()
    if (org) {
      org_id = org.id
      const { data: s } = await supabase.from('sites').select('id').eq('org_id', org.id).limit(1).single()
      if (s) { site_id = s.id; return true }
    }
    return false
  }

  async function tryBrivo(id: string) {
    const { data } = await supabase.from('sites').select('id, org_id').eq('brivo_account_id', id).limit(1).single()
    if (data) { site_id = data.id; org_id = data.org_id; return true }
    const { data: org } = await supabase.from('organizations').select('id').eq('brivo_account_id', id).limit(1).single()
    if (org) {
      org_id = org.id
      const { data: s } = await supabase.from('sites').select('id').eq('org_id', org.id).limit(1).single()
      if (s) { site_id = s.id; return true }
    }
    return false
  }

  if (een_account_id)    await tryEen(een_account_id)
  if (!site_id && brivo_account_id) await tryBrivo(brivo_account_id)
  if (!site_id && site_name) {
    const { data } = await supabase.from('sites').select('id, org_id').ilike('name', `%${site_name}%`).limit(1).single()
    if (data) { site_id = data.id; org_id = data.org_id }
  }

  // ── Build initial incident fields ─────────────────────────────────────────
  let title       = ''
  let description = ''
  let severity    = 'medium'

  if (source === 'soc_alarm') {
    // On creation the action_taken is usually empty — use event label
    const actionLabel = action_taken ? (ACTION_LABELS[action_taken] ?? 'Incident') : (event_label ?? 'Alarm Event')
    title = `[SOC] ${actionLabel} — ${site_name ?? 'Unknown Site'}`
    const lines = [
      `Event: ${event_label ?? event_type ?? 'Unknown Event'}`,
      `Priority: ${priority ?? 'P3'}`,
      `Operator: ${operator_name ?? 'SOC'}`,
    ]
    if (action_taken) lines.push(`Action: ${ACTION_LABELS[action_taken] ?? action_taken}`)
    if (notes)        lines.push(`Notes: ${notes}`)
    description = lines.join('\n')
    severity    = PRIORITY_MAP[priority] ?? 'medium'
  } else if (source === 'soc_patrol') {
    title = `[Patrol] Issue at ${site_name ?? 'Unknown Site'}`
    const lines = [
      `Patrol: ${patrol_type ?? 'Virtual Patrol'}`,
      `Operator: ${operator_name ?? 'SOC'}`,
    ]
    if (issue_detail) lines.push(`Issue: ${issue_detail}`)
    description = lines.join('\n')
    severity    = 'medium'
  }

  // ── INSERT new incident ───────────────────────────────────────────────────
  const { data: incident, error } = await supabase
    .from('incidents')
    .insert({
      org_id,
      site_id,
      title,
      description,
      severity,
      status:         portalStatus,
      reported_by:    operator_name ?? 'GGSOC',
      source,
      source_id,
      soc_event_type: event_type ?? null,
      soc_priority:   priority   ?? null,
      soc_operator:   operator_name ?? null,
      soc_action:     action_taken  ?? null,
      resolved_at:    portalStatus === 'resolved' ? new Date().toISOString() : null,
    })
    .select()
    .single()

  if (error) {
    // Race condition duplicate — still ok
    if (error.code === '23505') {
      return NextResponse.json({ ok: true, duplicate: true })
    }
    console.error('[incidents/ingest] insert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, incident_id: incident.id, site_matched: !!site_id })
}
