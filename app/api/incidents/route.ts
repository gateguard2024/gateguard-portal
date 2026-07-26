import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

const OPEN = new Set(['open', 'investigating'])
const WINDOW_DAYS = 90

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeStats(rows: any[]) {
  const now = Date.now()
  const windowMs = WINDOW_DAYS * 864e5
  const winStart = now - windowMs
  let openCount = 0, resolvedCount = 0, downtimeMs = 0, mttrSum = 0, mttrN = 0
  let lastStart = 0, currentDown = 0
  for (const r of rows) {
    const started = r.started_at ? Date.parse(r.started_at) : (r.created_at ? Date.parse(r.created_at) : NaN)
    if (Number.isNaN(started)) continue
    if (started > lastStart) lastStart = started
    const open = OPEN.has(String(r.status))
    const ended = open ? now : (r.resolved_at ? Date.parse(r.resolved_at) : now)
    const dur = Math.max(0, ended - started)
    if (open) { openCount++; currentDown = Math.max(currentDown, now - started) }
    else { resolvedCount++; mttrSum += dur; mttrN++ }
    // downtime contribution within the rolling window
    const clampStart = Math.max(started, winStart)
    if (ended > clampStart) downtimeMs += ended - clampStart
  }
  const uptimePct = Math.max(0, Math.min(100, 100 * (1 - downtimeMs / windowMs)))
  return {
    openCount,
    resolvedCount,
    timeSinceLastMs: lastStart ? now - lastStart : null,   // "time since last incident"
    currentDowntimeMs: openCount ? currentDown : 0,        // longest active outage
    mttrMs: mttrN ? Math.round(mttrSum / mttrN) : null,    // mean time to resolve
    downtimeMs,                                            // total downtime in window
    uptimePct: Math.round(uptimePct * 100) / 100,
    windowDays: WINDOW_DAYS,
  }
}

export async function GET(req: NextRequest) {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)
  const siteId = req.nextUrl.searchParams.get('site_id')

  let query = supabase
    .from('incidents')
    .select('*')
    .order('started_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(500)

  if (siteId) query = query.eq('site_id', siteId)
  query = applyOrgScope(query, scope, 'org_id')

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = data ?? []
  return NextResponse.json({ incidents: rows, stats: computeStats(rows) })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  const body = await req.json()
  const { title, description, severity, status, reported_by, site_id, category, cause, asset_id, started_at, source } = body

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const org_id = user.isCorporate ? (body.org_id ?? null) : (user.org_id ?? null)

  const { data, error } = await supabase
    .from('incidents')
    .insert({
      org_id,
      site_id:     site_id ?? null,
      title,
      description: description ?? null,
      severity:    severity ?? 'medium',
      status:      status ?? 'open',
      category:    category ?? null,
      cause:       cause ?? null,
      asset_id:    asset_id ?? null,
      source:      source ?? 'manual',
      started_at:  started_at ?? new Date().toISOString(),
      reported_by: reported_by ?? user.name ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Reflect the fault on the device's live status so fleet health drops immediately.
  if (asset_id) {
    const { error: aErr } = await supabase.from('site_assets').update({ status: 'offline' }).eq('id', asset_id)
    if (aErr) console.warn('[incidents] asset status update failed:', aErr.message)
  }

  return NextResponse.json({ incident: data }, { status: 201 })
}
