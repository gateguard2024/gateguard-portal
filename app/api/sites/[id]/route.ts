import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'
import { applyFieldAccess, logSensitiveAccess, SITE_SENSITIVE, CONTACT_SENSITIVE } from '@/lib/sensitive-fields'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// GET /api/sites/[id] — full site detail with field-level access control
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  const user   = await getCurrentUser()
  const scope  = await resolveOrgScope(user)

  // Check tech-code auth (field techs bypass Clerk but can see access info)
  const isTechCode = req.headers.get('x-tech-code') === process.env.TECH_ACCESS_CODE

  const [siteRes, assetsRes, eventsRes, workOrdersRes] = await Promise.all([
    supabase.from('sites').select('*').eq('id', id).single(),

    supabase
      .from('site_assets')
      .select(`
        id, product_id, product_name, product_sku, product_category,
        serial_number, mac_address, ip_address, firmware_version,
        location_note, location_zone,
        installed_by, installed_at,
        status, last_seen_at, offline_since,
        notes, created_at
      `)
      .eq('site_id', id)
      .neq('status', 'removed')
      .order('location_zone', { ascending: true, nullsFirst: false })
      .order('product_category', { ascending: true }),

    supabase
      .from('site_events')
      .select('id, event_type, event_source, title, description, summary, severity, metadata, created_at')
      .eq('site_id', id)
      .order('created_at', { ascending: false })
      .limit(20),

    supabase
      .from('work_orders')
      .select('id, wo_number, title, status, priority, scheduled_date, assignee_name, created_at')
      .eq('site_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  if (siteRes.error) {
    if (siteRes.error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 })
    }
    return NextResponse.json({ error: siteRes.error.message }, { status: 500 })
  }

  const rawSite = siteRes.data

  // ── Org isolation check ────────────────────────────────────────────
  // Verify the caller is actually allowed to see this site
  if (!scope.all) {
    const allowed =
      scope.ids.includes(rawSite.master_dealer_id) ||
      scope.ids.includes(rawSite.install_dealer_id) ||
      scope.ids.includes(rawSite.service_dealer_id) ||
      scope.ids.includes(rawSite.org_id)

    if (!allowed) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
  }

  // ── Field-level access control ─────────────────────────────────────
  const site = applyFieldAccess(rawSite as Record<string, unknown>, user, { isTechCode })

  // Log if sensitive fields were accessed
  const accessedSensitive = [...SITE_SENSITIVE, ...CONTACT_SENSITIVE].filter(
    f => rawSite[f] != null
  )
  if (accessedSensitive.length > 0 && (user.canViewSensitive || isTechCode)) {
    logSensitiveAccess({
      user,
      tableName: 'sites',
      recordId:  id,
      fields:    accessedSensitive,
      ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
    })
  }

  return NextResponse.json({
    site,
    assets:      assetsRes.data ?? [],
    events:      eventsRes.data ?? [],
    work_orders: workOrdersRes.data ?? [],
  })
}

// PATCH /api/sites/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  const user   = await getCurrentUser()
  const scope  = await resolveOrgScope(user)

  // Verify the site is in the caller's scope before allowing update
  if (!scope.all) {
    const { data: check } = await supabase
      .from('sites')
      .select('master_dealer_id, install_dealer_id, service_dealer_id, org_id')
      .eq('id', id)
      .single()

    if (!check) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const allowed =
      scope.ids.includes(check.master_dealer_id) ||
      scope.ids.includes(check.install_dealer_id) ||
      scope.ids.includes(check.service_dealer_id) ||
      scope.ids.includes(check.org_id)

    if (!allowed) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await req.json()

  // Dealers can't reassign org FKs to orgs outside their scope
  if (!user.isCorporate && !user.isMasterAgent) {
    delete body.master_dealer_id
    delete body.org_id
  }

  const { data, error } = await supabase
    .from('sites')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ site: data })
}

// DELETE /api/sites/[id] — admin/master dealer only
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  const user   = await getCurrentUser()

  if (!user.isCorporate && !user.isMasterAgent && !user.isMasterDealer) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { error } = await supabase.from('sites').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
