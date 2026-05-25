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
 * Three accepted payload shapes:
 *
 * 1. Supabase Database Webhook (most reliable — server-side, fires 24/7):
 *    Configure in GGSOC Supabase → Database → Webhooks → alarms table → INSERT + UPDATE
 *    Target URL: https://portal.gateguard.co/api/incidents/ingest
 *    Headers: x-ggsoc-secret: <GGSOC_INGEST_SECRET>
 *    {
 *      type:       'INSERT' | 'UPDATE'
 *      table:      'alarms'
 *      schema:     'public'
 *      record:     { id, site_name, event_type, priority, status, operator_name, ... }
 *      old_record: { ... } | null
 *    }
 *
 * 2. GGSOC portalIngest.ts browser shape (legacy, still supported):
 *    { source: 'soc_alarm'|'soc_patrol', source_id, incident_status, site_name, priority, ... }
 *
 * 3. Direct shape:
 *    { alarm_type, severity, property_name, description, source, triggered_by, site_id }
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

  // ── Detect payload shape ──────────────────────────────────────────────────
  const isSupabaseWebhook = typeof body.type === 'string' && body.table === 'alarms' && body.record
  const isGgsocShape      = !isSupabaseWebhook && (body.source === 'soc_alarm' || body.source === 'soc_patrol')
  // else: direct shape

  // ── Handle Supabase webhook ───────────────────────────────────────────────
  if (isSupabaseWebhook) {
    const record     = body.record as Record<string, unknown>
    const oldRecord  = body.old_record as Record<string, unknown> | null
    const webhookType = String(body.type) // 'INSERT' | 'UPDATE'

    const priorityMap: Record<string, string> = { P1: 'critical', P2: 'high', P3: 'medium', P4: 'low' }
    const severity = priorityMap[record.priority as string] ?? 'high'
    const sourceExtId = String(record.id)

    // INSERT → create a new open incident
    if (webhookType === 'INSERT') {
      const alarmType  = String(record.event_type ?? 'alarm')
      const siteName   = String(record.site_name ?? '')
      const titleBase  = alarmType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      const title      = siteName ? `${titleBase} — ${siteName}` : titleBase
      const descParts: string[] = []
      if (record.event_label)  descParts.push(String(record.event_label))
      if (record.notes)        descParts.push(String(record.notes))
      const description = descParts.join(' · ') || null
      const reportedBy  = record.operator_name
        ? `GGSOC / ${record.operator_name}`
        : 'GGSOC'

      // ── Site lookup: resolve site_id + org_id for hierarchy scoping ──────
      // Match by een_account_id first (most precise), then brivo_account_id, then site name
      let resolvedSiteId: string | null = null
      let resolvedOrgId:  string | null = null
      try {
        const eenId   = record.een_account_id   ? String(record.een_account_id)   : null
        const brivoId = record.brivo_account_id ? String(record.brivo_account_id) : null

        let siteQuery = supabase
          .from('sites')
          .select('id, master_dealer_id, install_dealer_id, service_dealer_id, org_id')
          .limit(1)

        if (eenId) {
          siteQuery = siteQuery.eq('een_account_id', eenId)
        } else if (brivoId) {
          siteQuery = siteQuery.eq('brivo_account_id', brivoId)
        } else if (siteName) {
          siteQuery = siteQuery.ilike('name', `%${siteName}%`)
        }

        const { data: siteRow } = await siteQuery.maybeSingle()
        if (siteRow) {
          resolvedSiteId = siteRow.id
          // Primary org for this incident = master dealer (account owner)
          resolvedOrgId  = siteRow.master_dealer_id ?? siteRow.org_id ?? null
        }
      } catch (_) { /* non-blocking — scoping degrades gracefully */ }

      const { data, error } = await supabase
        .from('incidents')
        .insert({
          org_id:        resolvedOrgId,
          site_id:       resolvedSiteId,
          title,
          description,
          severity,
          status:        'open',
          reported_by:   reportedBy,
          source_ext_id: sourceExtId,
          source_system: 'ggsoc',
        })
        .select('id')
        .single()

      if (error) {
        console.error('[incidents/ingest] INSERT error:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ id: data.id, action: 'created' }, { status: 201 })
    }

    // UPDATE → if the alarm was resolved, close the matching incident
    if (webhookType === 'UPDATE') {
      const newStatus = String(record.status ?? '')
      const wasResolved = (newStatus === 'resolved' || newStatus === 'closed' || newStatus === 'completed')
        && oldRecord
        && oldRecord.status !== record.status

      if (wasResolved) {
        // First try to find by source_ext_id (exact match)
        const { data: byId } = await supabase
          .from('incidents')
          .update({
            status:      'resolved',
            resolved_at: new Date().toISOString(),
            reported_by: record.operator_name
              ? `GGSOC / ${record.operator_name}`
              : 'GGSOC',
          })
          .eq('source_ext_id', sourceExtId)
          .eq('status', 'open')
          .select('id')

        if (byId && byId.length > 0) {
          return NextResponse.json({ ids: byId.map(r => r.id), action: 'resolved' })
        }

        // Fallback: resolve most recent open incident for this site
        const siteName = String(record.site_name ?? '')
        if (siteName) {
          const { data: bySite } = await supabase
            .from('incidents')
            .update({ status: 'resolved', resolved_at: new Date().toISOString() })
            .ilike('title', `%${siteName}%`)
            .eq('status', 'open')
            .order('created_at', { ascending: false })
            .limit(1)
            .select('id')

          if (bySite && bySite.length > 0) {
            return NextResponse.json({ ids: bySite.map(r => r.id), action: 'resolved' })
          }
        }
      }

      return NextResponse.json({ action: 'no_change' })
    }

    return NextResponse.json({ action: 'ignored', type: webhookType })
  }

  // ── Normalise GGSOC browser shape or direct shape ─────────────────────────
  const priorityMap: Record<string, string> = { P1: 'critical', P2: 'high', P3: 'medium', P4: 'low' }

  const alarmType: string = String(
    isGgsocShape
      ? (body.event_type ?? body.source ?? 'alarm')
      : (body.alarm_type ?? body.event_type ?? 'alarm')
  )
  const propertyName = String(isGgsocShape ? (body.site_name ?? '') : (body.property_name ?? '')) || undefined
  const rawSev       = isGgsocShape
    ? (priorityMap[body.priority as string] ?? 'high')
    : String(body.severity ?? 'medium')

  const validSeverities = ['low', 'medium', 'high', 'critical'] as const
  type Severity = (typeof validSeverities)[number]
  const severity: Severity = validSeverities.includes(rawSev as Severity) ? (rawSev as Severity) : 'medium'

  const resolvedStatus = (body.incident_status === 'resolved' || body.status === 'resolved')
    ? 'resolved' : 'open'

  const descParts: string[] = []
  if (body.event_label)  descParts.push(String(body.event_label))
  if (body.action_taken) descParts.push(`Action: ${body.action_taken}`)
  if (body.notes)        descParts.push(String(body.notes))
  if (body.issue_detail) descParts.push(String(body.issue_detail))
  if (body.description)  descParts.push(String(body.description))
  const description = descParts.join(' · ') || null

  const sourceName   = isGgsocShape
    ? (body.source === 'soc_patrol' ? 'GGSOC Patrol' : 'GGSOC')
    : String(body.source ?? 'GGSOC')
  const operatorName = (body.operator_name ?? body.triggered_by) as string | undefined
  const reportedBy   = operatorName ? `${sourceName} / ${operatorName}` : sourceName

  const titleBase = alarmType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const title     = propertyName ? `${titleBase} — ${propertyName}` : titleBase
  const siteId    = (body.site_id as string | undefined) ?? null
  const sourceExtId = (body.source_id as string | undefined) ?? null

  // If this is a resolve from the browser shape, update existing incident
  if (resolvedStatus === 'resolved' && sourceExtId) {
    const { data: updated } = await supabase
      .from('incidents')
      .update({ status: 'resolved', resolved_at: new Date().toISOString(), reported_by: reportedBy })
      .eq('source_ext_id', sourceExtId)
      .eq('status', 'open')
      .select('id')

    if (updated && updated.length > 0) {
      return NextResponse.json({ ids: updated.map(r => r.id), action: 'resolved' })
    }
  }

  // ── Site lookup for org attribution ────────────────────────────────────────
  let resolvedOrgId: string | null = null
  let resolvedSiteId: string | null = siteId

  if (!resolvedSiteId && propertyName) {
    // Try to find site by name when no site_id was provided
    try {
      const eenId   = (body.een_account_id   as string | undefined) ?? null
      const brivoId = (body.brivo_account_id as string | undefined) ?? null

      let siteQ = supabase
        .from('sites')
        .select('id, master_dealer_id, install_dealer_id, service_dealer_id, org_id')
        .limit(1)

      if (eenId)        siteQ = siteQ.eq('een_account_id', eenId)
      else if (brivoId) siteQ = siteQ.eq('brivo_account_id', brivoId)
      else              siteQ = siteQ.ilike('name', `%${propertyName}%`)

      const { data: siteRow } = await siteQ.maybeSingle()
      if (siteRow) {
        resolvedSiteId = siteRow.id
        resolvedOrgId  = siteRow.master_dealer_id ?? siteRow.org_id ?? null
      }
    } catch (_) { /* non-blocking */ }
  } else if (resolvedSiteId) {
    // site_id was provided — look up org attribution
    try {
      const { data: siteRow } = await supabase
        .from('sites')
        .select('master_dealer_id, org_id')
        .eq('id', resolvedSiteId)
        .maybeSingle()
      if (siteRow) resolvedOrgId = siteRow.master_dealer_id ?? siteRow.org_id ?? null
    } catch (_) { /* non-blocking */ }
  }

  const { data, error } = await supabase
    .from('incidents')
    .insert({
      org_id:        resolvedOrgId,
      site_id:       resolvedSiteId,
      title,
      description,
      severity,
      status:        resolvedStatus,
      reported_by:   reportedBy,
      source_ext_id: sourceExtId,
      source_system: isGgsocShape ? 'ggsoc' : null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[incidents/ingest] Supabase insert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ id: data.id, action: 'created' }, { status: 201 })
}
