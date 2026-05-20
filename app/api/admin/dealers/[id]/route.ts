/**
 * GET   /api/admin/dealers/[id]  — full dealer detail with aggregated stats
 * PATCH /api/admin/dealers/[id]  — update is_active, contact fields
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const caller = await getCurrentUser()
  if (!caller.isCorporate && !caller.isMasterAgent && !caller.isMasterDealer) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = params

  // Core org record
  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', id)
    .single()

  if (orgErr || !org) {
    return NextResponse.json({ error: 'Dealer not found' }, { status: 404 })
  }

  // Commission config
  const { data: commissionConfig } = await supabase
    .from('commission_config')
    .select('*')
    .eq('org_id', id)
    .single()

  // Sites count
  const { count: sitesCount } = await supabase
    .from('sites')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', id)

  // Active WOs count
  const { count: activeWOsCount } = await supabase
    .from('work_orders')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', id)
    .in('status', ['open', 'in_progress', 'scheduled', 'in_route', 'on_site'])

  // Commission summary (last 12 months)
  const { data: commissionSummary } = await supabase
    .from('rep_commissions')
    .select('amount_cents, status, pay_period')
    .eq('org_id', id)
    .order('pay_period', { ascending: false })
    .limit(12)

  const totalCommissionCents = (commissionSummary ?? [])
    .filter(c => c.status === 'paid' || c.status === 'approved')
    .reduce((s: number, c: { amount_cents: number }) => s + c.amount_cents, 0)

  // Monthly MRR from sites (estimate: $10/unit/month default if no billing data)
  const { data: sitesList } = await supabase
    .from('sites')
    .select('id, name, unit_count, monthly_mrr, status, last_wo_date, contract_end_date')
    .eq('org_id', id)
    .order('name', { ascending: true })

  const monthlyRevenue = (sitesList ?? []).reduce(
    (s: number, site: { monthly_mrr?: number | null; unit_count?: number | null }) =>
      s + (site.monthly_mrr ?? 0),
    0
  )

  // Recent WOs
  const { data: recentWOs } = await supabase
    .from('work_orders')
    .select('id, title, status, priority, scheduled_date, tech_name')
    .eq('org_id', id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Commission payouts
  const { data: commissionPayouts } = await supabase
    .from('rep_commissions')
    .select(`
      *,
      sales_reps(first_name, last_name, tier)
    `)
    .eq('org_id', id)
    .order('pay_period', { ascending: false })
    .limit(50)

  return NextResponse.json({
    org,
    commission_config: commissionConfig ?? null,
    stats: {
      sites_count:       sitesCount ?? 0,
      active_wos_count:  activeWOsCount ?? 0,
      monthly_revenue:   monthlyRevenue,
      total_commission:  totalCommissionCents,
    },
    sites:              sitesList ?? [],
    recent_wos:         recentWOs ?? [],
    commission_payouts: commissionPayouts ?? [],
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const caller = await getCurrentUser()
  if (!caller.isCorporate && !caller.isMasterAgent) {
    return NextResponse.json({ error: 'Forbidden — corporate admin only' }, { status: 403 })
  }

  const { id } = params

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Allowed fields only
  const allowed = ['is_active', 'name', 'email', 'phone', 'website', 'address', 'city', 'state', 'zip', 'license_number', 'tech_count']
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of allowed) {
    if (k in body) updates[k] = body[k]
  }

  const { data, error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, org: data })
}
